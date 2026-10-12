---
title: Horizon Social Network - Microservices Backend
sidebar_position: 3
tags: [Go, Microservices, MongoDB, Neo4j, Istio, Keycloak, Kubernetes, Docker]
description: A Go backend for a campus social network, built for a university workshop project. Two microservices on Kubernetes behind the Istio service mesh, with Keycloak login tokens checked at the entry gateway, mTLS between services, MongoDB for posts, Neo4j for the follower graph, and container images under 10MB.
---

import Architecture from './images/architecture.svg';

[View Source Code on GitHub](https://github.com/rayen-dhmaied/hornet) →

## Overview

### What it is
Horizon Social Network is a Go backend for a campus social network. I built it as a side project for a university workshop, and it did not run in production.

It has two services. Posts stores user posts in MongoDB, a document database. Followers stores who follows whom in Neo4j, a graph database that keeps users as nodes and follows as links between them.

Both services run on Kubernetes behind Istio, a service mesh that routes and secures traffic between services. Keycloak, an open-source identity provider, issues the login tokens (JWTs). The Istio ingress gateway, the entry point into the cluster, checks each token before the request reaches a service. Inside the mesh, Istio encrypts service-to-service traffic with mutual TLS (mTLS), where both sides prove their identity with certificates.

### Why it exists
I built it to apply microservices and Kubernetes in practice. Posts and follower relationships have different data shapes, so I split them into two services, each with a database that fits its data.

In the workshop I applied the parts I care about as a cloud and DevOps engineer: container builds, Kubernetes deployment, Istio policy, authentication at the gateway, and service boundaries.

### Outcome

:::tip[Key Results]
- Distroless images under 10MB per service, about 90% smaller than the same build on a full Linux distribution base image. A distroless image holds the app and its runtime files, with no shell or package manager.
- One database per service: MongoDB for posts and timelines, Neo4j for the follower graph
- Istio validates Keycloak JWTs at the gateway and enforces mTLS, so the Go services contain no JWT parsing code
- Kubernetes manifests cover the whole deployment: services, configuration, secrets, and Istio routing
:::

---

## Architecture

### High-Level Flow

<figure className="diagram">
  <Architecture />
</figure>

:::info[Key Components]
The client enters through the Istio ingress gateway. The gateway validates the Keycloak JWT against Keycloak's public signing keys (its JWKS, or JSON Web Key Set) before the request reaches a service, then Istio routes the request through the mesh. Posts reads and writes MongoDB documents. Followers runs graph queries in Neo4j.
:::

---

## Implementation Highlights

- Both services use the same Go layout (handler, service, and repository layers) and have OpenAPI specs. One Dockerfile builds either service, selected with a build argument.
- MongoDB stores post documents with a `user_id` index for timeline reads. Neo4j stores `User` nodes and directional `FOLLOWS` relationships, so friend suggestions run as Cypher queries (Cypher is Neo4j's query language) inside the database.
- Istio enforces mTLS between services and validates Keycloak JWTs at the gateway through its `RequestAuthentication` and `AuthorizationPolicy` resources.
- Kubernetes manifests cover Deployments, ClusterIP services, Istio routing, ConfigMaps for connection settings, and Secrets for database credentials.

---

## Key Challenges & Solutions

### Challenge 1: Choosing the Right Database Per Workload

**Problem:** Posts fit a document model, and follower relationships fit a graph model. One database for both would either complicate timeline reads or push graph traversal (walking chains of follow relationships) into application code.

**Solution:** I split the backend by workload. Posts uses MongoDB for document storage and indexed timeline reads. Followers uses Neo4j for graph traversal and friend suggestions. When a feature needs both, one service calls the other over REST.

:::success[Result]
Each service uses a database that matches its query pattern. Friend suggestions are a Cypher query in Neo4j, with no nested joins in Go code.
:::

---

### Challenge 2: Keeping Auth Out of Each Service

**Problem:** Adding JWT parsing to each service would duplicate security code, and a third service would need the same code again.

**Solution:** I moved authentication to Istio. The ingress gateway validates Keycloak JWTs through `RequestAuthentication`, and `AuthorizationPolicy` blocks unauthenticated requests before they reach the Go code. The services read the identity headers Istio passes through.

:::success[Result]
The Go services contain no JWT parsing code, and a new service that joins the mesh gets the same auth policy.
:::
