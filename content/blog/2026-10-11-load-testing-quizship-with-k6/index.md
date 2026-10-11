---
slug: load-testing-quizship-with-k6
title: Load Testing QuizShip's Game Servers and API with k6
authors: [rayen-dhmaied]
tags: [k6, load-testing, websocket, api, kubernetes]
---

QuizShip is a live quiz platform. A teacher hosts a game, students join from their phones, and a Go server sends each question to every player over a WebSocket. A Python API handles accounts, billing and the teacher's dashboard. Both run on Kubernetes.

I wanted to know where QuizShip breaks before real traffic showed me, so I copied production into an isolated environment and ran six k6 tests against it. Claude Code helped me design the tests and analyze the data. This post covers what load testing is, how I wrote the tests in k6, including WebSocket tests that hold 30,000 connections, and what each test showed, mistakes included.

{/* truncate */}

{/* Imports sit below the truncate marker so the blog list page doesn't bundle the figures */}

import ChartFigure from '@site/src/components/ChartFigure';
import tables from './img/tables.json';
import K6Architecture from './img/architecture.svg';
import StickyRouting from './img/sticky-routing.svg';
import TestEnvironment from './img/test-environment.svg';
import FanoutOldRouting from './img/fanout-old-routing.svg';
import CpuPerGamePod from './img/cpu-per-game-pod.svg';
import RoutingAndK6 from './img/routing-and-k6-2x2.svg';
import BytesPerGame from './img/bytes-per-game.svg';
import CreateWaitOneIp from './img/create-wait-one-ip.svg';
import ApiCeilingSteps from './img/api-ceiling-steps.svg';
import OverloadTimeline from './img/overload-timeline.svg';

## What Load Testing Is

Load testing means sending more traffic to a system than it gets today, on purpose and to a copy of production, to see how it behaves before real users bring that traffic.

A load test starts with questions, and the system's architecture suggests them: what holds state, what every request depends on, how big a single unit can get, when the busiest moment is, and what happens past the limit.

---

## QuizShip's Architecture

QuizShip runs on a Kubernetes cluster on AWS (EKS). Each service is a Kubernetes Deployment: Kubernetes keeps a set number of identical pods running, and each pod is one running copy of the service.

<figure className="diagram">
  <K6Architecture />
</figure>

- **ingress-nginx** receives all traffic from outside the cluster. Paths under `/game` go to the game pods and paths under `/store` go to the API pods.
- **Game Deployment, 2 pods (Go).** Runs live games over WebSockets.
- **API Deployment, 2 pods (Python, Flask on gunicorn).** Accounts, billing, the quiz library and the dashboard.
- **Redis** holds game snapshots, the API's cache, rate limits and the job queue. **PostgreSQL** holds the API's data. A **Celery worker** runs background jobs such as emails.

The game servers call the API twice per game: to check the teacher's plan when a game is created, and to save the result when it ends.

API requests are stateless, so the ingress sends them to the API pods in turn. Game traffic has to be sticky instead. A live game lives in the memory of one game pod, so every player of that game has to reach that pod. The ingress takes the game id from the URL with a regex, hashes it and maps the hash to a pod, so each game stays on one pod while different games spread across the pods:

<figure className="diagram">
  <StickyRouting />
</figure>

Each game pod also saves its games to Redis. If a pod restarts, its players reconnect to another pod, which restores the game from Redis.

---

## The Questions I Started From

I wrote the questions down before writing any test script, so each test would have something to measure against. Asking the questions from the previous section about this architecture gave five:

1. **Does the load balancing spread the games?** A game lives on one pod, so if every game lands on the same pod, adding game pods adds no capacity. Tests 1 to 3 answer this.
2. **How many players can play at once before they notice?** "Notice" needs a number, so I set one: 95% of players get the next question within 500 ms of the host's click. Tests 1 to 3 answer this too.
3. **What does the biggest game cost?** The largest plan allows 500 players in one game, and all of them land on one pod. Test 4 answers this.
4. **What happens when everyone starts at once?** Classes start at the same time, so games are created in a burst at 9:00, not spread over the day. Test 5 answers this.
5. **How much dashboard traffic can the API serve, and what happens past that?** Every new game needs the API's plan check, so if the API goes down, no class can start. Test 6 answers this.

---

## Writing the Tests in k6

k6 is an open-source load testing tool. It runs a JavaScript file many times in parallel and records timings. It doesn't use a browser; it opens the HTTP and WebSocket connections and sends the messages itself.

A k6 script has two parts: a default function, which is what one simulated user does, and an `options` object, which says how to run it. These are the k6 terms the scripts below use, in the order they come up:

| term | meaning |
|---|---|
| virtual user (VU) | a simulated user that runs the default function in a loop; in my game test, one VU plays a whole class |
| iteration | one run of the default function; when it ends, the VU starts another |
| `Trend` | a custom metric that keeps every value, so k6 can report percentiles |
| p95 | the value 95% of measurements were at or below |
| think time | a pause that imitates a person reading or deciding |
| scenario | a named block in `options` that says how VUs and iterations are scheduled |
| executor | the scheduling rule a scenario follows |
| stage | one step of a ramp: a target and how long to take to reach it |
| ramp | load raised step by step, each step a climb followed by a hold |
| `ramping-vus` | an executor that keeps a set number of VUs running, a number that changes in stages |
| threshold | a pass/fail rule on a metric, such as p95 under 500 ms; a broken threshold fails the run |
| `ramping-arrival-rate` | an executor that starts a set number of iterations every second, however long earlier ones take |
| execution segment | the share of a test one k6 process runs when the test is split across machines |

### The Game Test: One VU Is One Class

In the game tests, one iteration is a whole class. It creates a game, opens the host's WebSocket and opens 30 player WebSockets. k6's WebSocket API is event-driven, like a browser's, so one VU can hold all 31 connections and react to their messages. Timers make the players behave like students:

```js
import { WebSocket } from 'k6/websockets';
import { setTimeout } from 'k6/timers';
import { Trend } from 'k6/metrics';

const fanout = new Trend('fanout_ms', true);
let hostClickedAt = 0;   // set when the host sends "next"

function student(url) {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type !== 'question') return;
    fanout.add(Date.now() - hostClickedAt);
    if (Math.random() < 0.95) {   // 5% of students never answer
      setTimeout(() => ws.send(JSON.stringify({ type: 'answer', choice: Math.floor(Math.random() * 4) })),
                 2000 + Math.random() * 13000);   // the rest answer after 2 to 15 seconds
    }
  };
  return ws;
}

export default function () {
  // create the game and open the host's socket, then students join over 30 seconds
  for (let i = 0; i < 30; i++) setTimeout(() => student(`${__ENV.WS_URL}/watch/${gameId}`), Math.random() * 30000);
}
```

The `fanout` metric is the time from the host clicking "next" to each player receiving the question, the number behind question 2. The host and its players run in the same VU, so both timestamps come from one clock. k6 runs inside the cluster, so this is the time spent inside QuizShip; a real phone adds its own network time on top. The script also records how long joining takes and how long a player's answer takes to reach the host.

The host waits 3 to 7 seconds on each results screen before moving on, like a teacher going over the answer. Without this think time, every VU would act in the same millisecond, which no real class does.

### How the Game Tests Raised the Load

The game tests used the `ramping-vus` executor, so the number of classes playing at once rose in stages. Each step climbed for 3 minutes and held for 6, and I measured only the holds, since a climb mixes several load levels. Question 2's 500 ms bar is a threshold on the fan-out metric:

```js
export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      stages: [
        { duration: '3m', target: 320 }, { duration: '6m', target: 320 },   // 320 classes, ~10,000 players
        { duration: '3m', target: 480 }, { duration: '6m', target: 480 },
        // and so on up to 960 classes, ~30,000 players
      ],
    },
  },
  thresholds: {
    fanout_ms: ['p(95)<500'],
  },
};
```

### The API Test

In the API test, one iteration is one HTTP request. Each picks a route weighted by how often the dashboard calls it, and a token from one of 50 test teachers:

```js
import http from 'k6/http';
import { SharedArray } from 'k6/data';

const TOKENS = new SharedArray('tokens', () => open('/tokens/tokens.txt').split('\n').filter(Boolean));
const ROUTES = [['/users/me', 30], ['/quiz-usage/dashboard?days=30', 20], ['/quiz-usage/history?days=30', 20],
  ['/quizzes', 20], ['/plans', 10]].flatMap(([path, weight]) => Array(weight).fill(path));

export const options = {
  scenarios: {
    api: {
      executor: 'ramping-arrival-rate',
      startRate: 25,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 3000,
      stages: [{ duration: '1m', target: 200 }, { duration: '4m', target: 200 } /* and up to 600 */],
    },
  },
};

export default function () {
  const path = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  http.get(`${__ENV.STORE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKENS[Math.floor(Math.random() * TOKENS.length)]}` },
    tags: { name: path.split('?')[0] },   // one result row per route
  });
}
```

I used `ramping-arrival-rate` here because teachers opening dashboards don't wait for each other. With a fixed number of VUs, a slower API would receive fewer requests, and the overload would never show.

The test teachers had 25 quizzes each and between 70 and 190 played games left by the game tests, so the dashboard queries did real work.

---

## Where the Tests Ran

### The Test Environment

- The same Kubernetes cluster as production, in a separate namespace, on a dedicated node pool. The pool's nodes carry a taint, which keeps off every pod that doesn't explicitly tolerate it, so test pods and production pods never share a node.
- The same images, Helm chart, replica counts and game settings as production, on the same instance family (t3).
- A separate copy of ingress-nginx with production's configuration, reachable only from inside the cluster.
- No production secrets, and Stripe in test mode.

<figure className="diagram">
  <TestEnvironment />
</figure>

Each service had a node to itself, while production shares nodes with other workloads, so these numbers are a best case. The cloud load balancer in front of production wasn't in the path, and neither was the internet between a phone and AWS, so every latency in this post is measured inside the cluster.

Prometheus already scraped every pod and node in the cluster. After each run, a script pulled CPU and memory per pod, CPU throttling, Redis operations and network bytes for the run's time window, so I could read k6's numbers and the servers' side by side.

### Running k6 in the Cluster

k6 ran inside the cluster as plain Kubernetes pods, started by a short shell script rather than the k6 operator. One k6 process can't open 30,000 connections, so the script splits a test into six slices with k6's execution segments and starts one pod per slice. Each pod:

- runs the official `grafana/k6` image, with the test script mounted from a ConfigMap and the test teachers' tokens from a Secret;
- lands on the test node pool, on a node where no pod of the system under test runs, so k6 never takes CPU from what it measures;
- resolves the test hostname to the ingress copy through `hostAliases`, so its traffic goes through the ingress and TLS like real traffic;
- writes its summary and every sample to CSV, which the script copies out when the run ends.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: k6-class-0                      # one pod per slice: 0 to 5
  labels: { app: k6 }
spec:
  restartPolicy: Never
  nodeSelector: { nodepool: loadtest }  # the dedicated test nodes
  tolerations: [{ key: loadtest, operator: Equal, value: "true", effect: NoSchedule }]
  affinity:
    podAntiAffinity:                    # not on a node running another pod of the test namespace
      requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname
        labelSelector:
          matchExpressions: [{ key: app, operator: NotIn, values: [k6] }]
  hostAliases:                          # the test hostname points at the ingress copy
  - ip: "<ingress ClusterIP>"
    hostnames: [api.loadtest.internal]
  containers:
  - name: k6
    image: grafana/k6:2.3.0
    args: [run, --execution-segment=0:1/6, --execution-segment-sequence=0,1/6,2/6,3/6,4/6,5/6,1,
           --out, csv=/out/metrics.csv.gz, /scripts/class.js]
    resources:
      requests: { cpu: "2", memory: 2Gi }   # no CPU limit; test 3 shows what a limit did
    volumeMounts:
    - { name: scripts, mountPath: /scripts }
    - { name: tokens, mountPath: /tokens }
    - { name: out, mountPath: /out }
  volumes:
  - { name: scripts, configMap: { name: k6-scripts } }
  - { name: tokens, secret: { secretName: k6-tokens } }
  - { name: out, emptyDir: {} }
```

---

## Test 1: Ramp to 30,000 Players

The first ramp went after questions 1 and 2 with production's routing. I ramped from 320 classes to 960, which is 10,000 to 30,000 players.

<ChartFigure table={tables['fanout-old-routing']}>
  <FanoutOldRouting />
</ChartFigure>

Fan-out was 7 ms at p95 with 10,000 players and 21 ms with 15,000. After that it climbed to 90 ms at 20,000 players and 458 ms at 30,000, just under the threshold. A curve that bends like that usually means a resource is running out, but the busiest node was only at 69% CPU. So I split the CPU graph by pod:

<ChartFigure table={tables['cpu-per-game-pod']}>
  <CpuPerGamePod />
</ChartFigure>

Pod A was doing all the work and pod B sat idle, which answered question 1: the load balancing wasn't spreading the games at all. The regex expected a path like `/watch/<id>`, but it ran before the ingress stripped the `/game` prefix, so it saw `/game/watch/<id>` and never matched. Every request got an empty hash key, and an empty key always lands on the same pod.

Production had the same configuration. None of our dashboards had caught it, because total CPU looked normal, requests succeeded and games finished.

I fixed the regex first, then removed it so there's nothing left to get wrong. Clients now send the game id as a query parameter, `?g=<game id>`, on every WebSocket and status request, and the ingress hashes on that parameter:

```yaml
annotations:
  nginx.ingress.kubernetes.io/upstream-hash-by: "$arg_g"   # hash on the ?g= query parameter
```

---

## Test 2: The Same Ramp with the Routing Fixed

With the fix, the two pods split the load within 10% of each other. Fan-out stayed at 15 ms or less up to 25,000 players, then jumped to 172 ms at 30,000.

I assumed I had found the next limit and went looking for it. Game node CPU peaked at 43%. The largest network flow was the snapshots going into Redis, 360 Mbps, far below what the node can carry, and Redis isn't on the fan-out path anyway, since the game sends a question before it saves the snapshot. No server-side resource was close to full.

That left the ingress or k6 itself. In tests 1 and 2, each k6 pod had a CPU limit of 0.6 cores. Kubernetes enforces a CPU limit in 100 ms periods: once a container has used its share of a period, it is paused until the next one, which is called throttling. Test 1's metrics showed the k6 pods throttled in 7% of their periods on average and in up to 52% during bursts, and test 2 used the same k6 setup.

---

## Test 3: Tests 1 and 2 Without k6's CPU Limit

The 172 ms came from my test setup, not the servers. Every time a host clicked "next", one VU had to handle 30 incoming messages at once. The pod hit its 0.6-core limit, Kubernetes paused it, and k6 counted its own delay as server latency.

I removed the limit, so the k6 pods could use the idle CPU on their nodes, and ran both routings again:

<ChartFigure table={tables['routing-and-k6-2x2']}>
  <RoutingAndK6 />
</ChartFigure>

Each pair of lines differs in one setting. The gap between the dashed and solid lines is what the k6 limit added, and the gap between the two colors is the routing fix. With the old routing, the rerun had test 1's shape a little lower, 64 ms at 20,000 players and 413 ms at 30,000, so test 1's conclusion held. With the routing fixed and k6 unlimited, 30,000 players got the next question in 13 ms at p95, measured inside the cluster, and each game pod used 1.3 to 1.4 of its 4 cores. That answered question 2 as far as the test environment could go: 30,000 players was the most it could generate, so I still don't know where the game servers' limit is.

I now check the load generator's throttling in every run:

```promql
sum by (pod) (rate(container_cpu_cfs_throttled_periods_total{namespace="loadtest"}[1m]))
  / sum by (pod) (rate(container_cpu_cfs_periods_total{namespace="loadtest"}[1m]))
```

---

## Test 4: One Room of 100, 250 and 500 Players

Question 3 is about a single big game, so I ran single games of 100, 250 and 500 players, each with players joining over 60 seconds and 20 questions. Latency was fine: the last of 500 players got each question within about 30 ms. The problem was the amount of data sent to the players:

<ChartFigure table={tables['bytes-per-game']}>
  <BytesPerGame />
</ChartFigure>

Going from 250 to 500 players multiplied the data by 7. On log-log axes the growth exponent came out between 2.6 and 2.8, nearly cubic, which pointed to something being sent to every player over and over, with a size that grew with the room.

Two messages did it. Each time a player joined, the server sent the whole player list to every player, so each of N joins went to N players with up to N names. After every question, every player also got the full leaderboard. When I checked the frontend, the player's screen used neither one: it only shows the player's own name and rank. One 500-player game sent 2.6 GB, about 5 MB per phone, and most of it went out during the one-minute lobby, roughly 290 Mbps through a single school's connection.

Now the full player list and the per-question leaderboard go only to the host, and each player gets just their own entry. A 500-player game sends 36 MB, 73 times less, about 72 KB per phone.

---

## Test 5: 240 Classes Start in the Same Minute

Question 4 is about 9:00 at a school, so in this test each class created its game at a random second within the same minute. I ran it twice, once with 240 classes spread over 12 IP addresses and once with 50 classes behind a single IP.

The 240 classes, 7,200 players in total, joined with a p95 of 18 ms, and server CPU barely moved. The single-IP run showed a different problem. Game creation is limited to 20 games a minute per IP address, and teachers at the same school usually share one public IP. 18 of the 50 teachers waited more than a second for their game, and the last one waited 53 seconds:

<ChartFigure table={tables['create-wait-one-ip']}>
  <CreateWaitOneIp />
</ChartFigure>

The servers had capacity to spare. The wait came from a rule meant to block abuse, and keyed by IP address it treats a whole school as one user. Keying the limit by the logged-in teacher would fix it.

---

## Test 6: The Dashboard API

Question 5 is about the API, so I ran the API test, raising the arrival rate from 25 to 600 requests a second. Each time I fixed what limited the API, the ceiling moved:

<ChartFigure table={tables['api-ceiling-steps']}>
  <ApiCeilingSteps />
</ChartFigure>

At first the API topped out around 230 requests a second. PostgreSQL was stuck at its 0.5-core CPU limit while its node was 76% idle, so I raised the limit to 1 core. The ceiling moved to about 340, where the API pods' own CPU became the limit.

### Profiling the API

The load test showed that the API's CPU was full, but not which code was using it. I attached py-spy, a sampling profiler that reads a Python process's call stacks from outside, through an ephemeral debug container, while k6 held a steady 300 requests a second:

```bash
kubectl debug pod/<api-pod> --image=python:3.12-slim --target=<api-container> --profile=general -- \
  sh -c "pip install py-spy && py-spy record --pid 1 --subprocesses --nonblocking --duration 180 --format raw -o /tmp/profile.txt"
```

The command writes the profile to a file. I lost my first profile by printing it to the container log instead: it was 12 MB, Kubernetes rotates container logs at 10 MiB, and the output was gone before I could copy it.

The first profile pointed at database round trips. I ran it again with `--gil`, which only counts threads that are running Python, and the round trips fell from 30% of the samples to 3%, because those threads had been waiting on the network. Most of the CPU went to turning every database row into an ORM object and counting each teacher's games in Python.

So I moved the dashboard's counting into SQL. That cut the API's CPU per request by about 20% but raised PostgreSQL's by about 50%, so the ceiling only reached 350 to 380 before PostgreSQL limited it again. A per-teacher cache of the dashboard and game history, cleared when the teacher starts or finishes a game, took it to about 500.

### Past the Ceiling

The second half of question 5 had the worse answer. Every run that went past the ceiling collapsed instead of slowing down. This one had PostgreSQL at 1 core, so its ceiling was about 340 requests a second:

<ChartFigure table={tables['overload-timeline']}>
  <OverloadTimeline />
</ChartFigure>

At 400 requests a second, completed requests flattened around 300, and the p95 of the requests that did get answered went from 50 ms to 10 to 20 seconds. Each API pod handles 32 requests at a time (4 gunicorn workers with 8 threads each) and queues the rest. The Kubernetes liveness probe waited in that same queue with a 1-second timeout, so Kubernetes concluded the pods were dead and restarted them, 13 times in ten minutes. Each restart dropped the requests that pod was handling and pushed its traffic onto the other pod.

A more patient probe didn't help. In another run I gave it 60 seconds, and the pods still restarted, just later, because under overload every request waits longer than any timeout, the probe included. The probe needs to answer without queueing behind requests, and the API should turn away extra requests quickly with a 429 or 503 instead of queueing them.

---

## What the Tests Answered

| question | answer | what changed |
|---|---|---|
| 1. Does the load balancing spread the games? | no, every game went to one pod (test 1) | routing on `?g=`; both pods now share the load within 10% |
| 2. How many players at once within 500 ms? | 30,000 at 13 ms on two pods, the most the environment could generate (test 3); with the old routing, 413 ms at 30,000 | the routing fix; k6 now runs without a CPU limit |
| 3. What does the biggest game cost? | 2.6 GB sent to 500 players (test 4) | 36 MB, with the player list and leaderboard sent to the host only |
| 4. What happens when everyone starts at once? | 7,200 players joined at 18 ms p95; teachers behind one IP waited up to 53 s (test 5) | the per-IP limit needs to count per teacher |
| 5. How much API traffic, and what happens past it? | about 230, then 340, then 500 requests a second; past that, the health probe restarted the pods (test 6) | PostgreSQL's CPU limit and the dashboard cache are in production; the probe and load shedding need to change |
