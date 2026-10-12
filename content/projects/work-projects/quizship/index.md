---
title: QuizShip - Live Interactive Quiz Platform
sidebar_position: 4
tags: [Python, Flask, Go, WebSocket, React, TypeScript, Stripe, Claude, LTI, Kubernetes, ArgoCD, Prometheus, Grafana, PostgreSQL, Redis, Celery, k6]
description: Live multiplayer quiz SaaS built as a Go game server and a Python API with a React frontend, Stripe subscriptions, and GitOps deploys on Kubernetes. Load-tested to 30,000 concurrent players on two game pods with zero errors.
---

import Architecture from './images/architecture.svg';

**Live App:** [quizship.com](https://quizship.com)  
**API Docs:** [api.quizship.com/store/docs](https://api.quizship.com/store/docs)  
**Load Test Write-up:** [Load Testing QuizShip's Game Servers and API with k6](/blog/load-testing-quizship-with-k6)

## Overview

### What it is
QuizShip is a live multiplayer quiz platform. A teacher hosts a game, students join from their phones, and a Go server sends each question to every player and tracks answers and scores in real time. Hosts write quizzes in one of six game formats or generate them with Claude, and QuizShip also opens from inside a course in a learning management system (LMS).

I led QuizShip's development at CraftSchoolship and built both backend services, which are my strongest work on the project. The Go service runs the live games, and the Python service runs accounts, billing, quotas, the quiz library, AI generation, and LMS integration. I also worked on the React and TypeScript frontend.

### Why two services
Python's libraries made the product side fast to build, but its support for WebSockets and concurrency is weaker. Go's goroutines (lightweight threads) suit long-lived game sessions, but rebuilding what Flask, SQLAlchemy, and the Stripe SDK provide would have cost months in Go and given users nothing new.

The two services share the secret that signs login tokens (JWTs), so the Go service checks tokens itself without a network call. Go calls the Python service twice per game, to check the host's plan when the game is created and to save the result when it ends, because the Python service owns plans and results.

### Outcome

:::tip[Key Results]
- In a k6 load test on an isolated copy of production, two copies (pods) of the Go game server held 30,000 simulated players with zero errors, and 95% of question deliveries arrived within 13 ms of the host's click, against a 500 ms target. That latency was measured inside the cluster, without the players' own internet connections, and 30,000 was the most the test environment could generate.
- The load tests also found that production was sending every live game to one of its two game pods. After my routing fix, the two pods' CPU stayed within 10% of each other under the same load.
- Gzipping the copy of each live game kept in Redis, and writing it at most every 2 seconds, cut the bytes sent to Redis by 93% in a replayed class. Priced at AWS on-demand rates from the load test's usage, that lowers the estimated cost of 30,000 players from $4.66 to $2.03 an hour.
- Tiered Stripe subscriptions with a metered AI quota. I rebuilt billing to handle late and out-of-order Stripe events, simultaneous requests, refunds, and disputes, and none of the original billing races has recurred in production.
- Quiz generation with Claude from a prompt or a PDF, and launches from LMS courses through LTI 1.3, the standard LMSs use to open external tools.
- Six game formats, each a separate module on the Go server and the frontend.
- About 1,750 Python tests and a Go suite run under the race detector must pass before CI builds each image.
:::

---

## Architecture

<figure className="diagram">
  <Architecture />
</figure>

:::info[Architecture Overview]
The Python service (Flask) handles auth, billing, content, AI generation, LTI, admin, and Stripe webhooks, and uses Redis for caching, rate limits, and locks. The Go service runs the live games and keeps their snapshots in Redis. Celery workers take background jobs from Redis and write to PostgreSQL.
:::

---

## Implementation Highlights

### Backend

- **Live games.** Each game runs as an actor, a single goroutine that owns the game's state and handles player events one at a time from its mailbox, so game code needs no locks. WebSocket heartbeats every 10 seconds drop dead connections, so abandoned games get cleaned up.
- **Game state.** After each burst of player events the game encodes its state, and a panic (Go's unhandled runtime error) rolls the game back to it while the pod keeps running. That state goes to Redis as the game's snapshot, so another pod can take the game over. Snapshots were 62% of the estimated AWS cost at 30,000 players, so they are gzipped and written at most every 2 seconds. A pod that crashes instead of shutting down cleanly can lose up to 2 seconds of play.
- **Results.** Each finished game's result goes into an outbox in Redis, a queue that holds it until the Python service accepts it. Retries back off exponentially, a time-limited claim (lease) stops two pods from posting the same result, and entries that run out of retries move to a dead-letter set. An outage of the Python service delays results and loses none.
- **Billing and margins.** Every payment, refund, and dispute goes into a ledger that feeds MRR (monthly recurring revenue), ARPU (average revenue per user), the paid churn rate, and MRR movements split into new, expansion, contraction, and churn. Each AI generation records its tokens and cost, and the admin view shows AI spend per account next to the plan's price, which gives each tier's margin. Plans are cached, and during a Stripe outage feature checks use a cached plan up to 7 days old.
- **Security.** LTI 1.3 launches verify the LMS's signed ID token against its published signing keys (JWKS), fetched only from public HTTPS hosts to block server-side request forgery (SSRF). The editor token goes in the URL fragment, which browsers don't send to the server, so it never reaches server logs. A revoked session stops working on its next request, and auth, billing, and AI routes are rate limited.
- **Delivery.** Helm packages both services and the Celery workers, ArgoCD keeps the cluster in sync with Git (GitOps), and CI builds each image only after its tests pass. Prometheus and Grafana alert on latency, error rate, uptime, and stuck background jobs.

### Frontend

- **Game modules.** The frontend is React 19 and TypeScript, built with Vite. Each of the six game formats is a module with its own editor, host screen, player screen, and results view. Each part loads the first time it's used, so the dashboard doesn't download every format's editor just to list the formats.
- **Real-time client.** One React hook manages the WebSocket connection for every format. It retries a dropped connection with capped backoff, keeps retrying longer on close code 1001, which the Go server sends when a pod shuts down for a deploy, and stops on 1000, which it sends when the game ends.

---

## Key Challenges & Solutions

### Challenge 1: Adding New Game Formats Without Rewriting Every Page

**Problem:** The first version assumed one game format. A second would have meant if/else branches across the authoring page, the host screen, the player view, the LTI flow, and the dashboard, and more branches for every format after it.

**Solution:** I moved everything specific to a format behind a contract interface and a registry keyed by `kind` (the format's id), with sub-contracts for authoring, hosting, and playing. Pages look up the format in the registry instead of branching on string literals. For LMS launches that don't specify a `kind`, the frontend asks each registered contract whether it recognizes the launch data. The Go server does the same with a `game.Type` interface, so its room, snapshot, and result code never branch on `kind`.

:::success[Result]
On both the frontend and the Go server, a new format is one directory with one contract and one registration. The second format shipped without changes to the host, play, or dashboard pages, and each later format was added the same way.
:::

---

### Challenge 2: Scaling a Stateful WebSocket Server Behind a Stateless Ingress

**Problem:** Each live game's state lives in memory on one Go pod, so all of that game's HTTP and WebSocket traffic must reach that pod. Round-robin balancing at the ingress (the cluster's entry point for outside traffic) would break games in progress as soon as the deployment ran more than one pod.

**Solution:** Clients send the game id as a `?g=` query parameter on every WebSocket and status request, and the nginx ingress hashes on it with `upstream-hash-by: "$arg_g"`. The same game always reaches the same pod, and different games spread across pods. A pod that receives a game it doesn't hold loads it from its Redis snapshot. On shutdown, a pod closes its sockets with code 1001. Clients reconnect, and the pod that now owns the game restores the snapshot and reschedules its running timers.

The first version hashed on a game id that a regex captured from the request path. The regex ran before the ingress stripped the `/game` prefix, so it never matched, every request hashed an empty key, and every game went to the same pod. That configuration was in production. Requests still succeeded and total CPU looked normal, so no dashboard showed the problem. I found it in the first k6 load test, where one game pod did all the work while the other was idle. Hashing on a query parameter needs no regex, so the path rewrite can't break it.

:::success[Result]
After the fix, the two game pods' CPU stayed within 10% of each other in the load test, so adding pods adds capacity. Scaling out and rolling deploys don't end games in progress.
:::

---

### Challenge 3: Keeping Stripe and Local State in Sync Under Real Traffic

**Problem:** Stripe reports subscription and payment changes through webhooks, and those arrive late, out of order, and again after transient failures. Concurrent actions from one user, such as a double-click on upgrade or a reactivate while a downgrade is queued, can reach Stripe at the same time and conflict. The first version trusted the data in each webhook and let one user's updates run at the same time, and both failed under live traffic. Mid-period plan changes caused more bugs. A last-day upgrade handed out a full month of AI quota, and a refund left the paid plan running.

**Solution:** I rebuilt the billing flow around four rules.
- Each webhook handler fetches the subscription's current state from Stripe and writes local state from that response, so an old or out-of-order event can't overwrite newer state. A handler that fails returns HTTP 500 so Stripe retries, and a stored event id stops a retry from being applied twice.
- A per-user lock in Redis and a row lock in PostgreSQL make update, cancel, and reactivate for one user run one at a time.
- Each customer has at most one live subscription. The Python service refuses a second checkout, expires stale checkout sessions, and cancels duplicates.
- Upgrades invoice the prorated difference immediately and grant only the remaining share of the new plan's AI quota. Downgrades take effect at period end through a Stripe subscription schedule. A dispute or a full refund of the current period ends the paid plan.

:::success[Result]
Wrong local subscription state is fixed on the next Stripe event for that customer, because each handler rewrites it from Stripe. I verified each billing path end to end with Stripe test clocks, which simulate time passing on a test subscription, and none of the original races has recurred in production.
:::

---

### Challenge 4: Getting Playable Quizzes Out of a Language Model

**Problem:** Each format has its own JSON shape and rules, such as answer counts, fields that must agree, and values that must stay hidden from players. A reply can pass a JSON schema and still be unplayable or padded with placeholder text.

**Solution:** Generation runs on Claude with structured output, which makes each reply follow the format's JSON schema, so every reply parses. A per-format validator checks the rules a schema can't express and catches placeholder text. If validation fails and the time budget allows, the service sends Claude the exact problems for one repair round. Input is a text prompt or a PDF, and the system prompt shared by all formats is cached.

:::success[Result]
A draft that still fails after the repair round returns an error and costs the host no quota. Its token cost still counts toward the plan's margin.
:::
