---
title: Kubernetes Observability Stack
sidebar_position: 2
tags: [Kubernetes, Prometheus, Grafana, Loki, Jaeger, Kiali, Terraform, AWS, S3, Keycloak, Oncall, Monitoring, Uptime Kuma, Nginx, Istio]
description: Monitoring and alerting stack I built for production Kubernetes on AWS EKS. It cut mean time to resolve incidents (MTTR) by 50%, log storage cost by 70%, and alert volume by 60%, with Prometheus, Loki, Grafana OnCall, and external HTTPS probes.
---

import AlertingFlow from './images/alerting-flow.svg';

## Overview

### What it is
I built the observability stack for CraftSchoolship's production Kubernetes workloads on Amazon EKS, end to end. It covers the metrics, logs, traces, and alerts the team uses to find and fix production problems, and I set up the on-call rotation that receives those alerts. Prometheus collects metrics, Loki stores logs, Jaeger records traces (the path of one request through several services), Kiali maps traffic between services in the Istio service mesh, and Grafana shows these signals on dashboards and runs the alert rules.

I also deployed Uptime Kuma, an open-source uptime monitor, on a separate AWS Lightsail server. It checks each customer's HTTPS domain from outside the AWS account that runs EKS, and it hosts a public status page customers can check during incidents.

### Why it exists
Engineers had to switch between clusters, pods, and shell sessions to answer basic questions during an incident. Reading logs meant running `kubectl logs`, alerts fired from different places, and customer-facing outages often reached us through support tickets first.

I wanted the signals and alerts in one place, plus a check from outside the cluster against the same HTTPS addresses customers use.

### Outcome

:::tip[Key Results]
- Mean time to resolve an incident (MTTR) cut by 50%
- Log storage cost down 70% after moving Loki's log data and indexes to Amazon S3
- Alert volume down 60% after rebuilding thresholds from the previous quarter (three months) of incident history
- External HTTPS checks and a public status page that run outside the cluster, so they keep working during a cluster outage
- A runbook (written response steps) on every alert, and an on-call rotation with escalation
:::

---

## Architecture

### Alerting Flow

<figure className="diagram">
  <AlertingFlow />
</figure>

:::info[Alert Flow]
Prometheus and Loki send in-cluster alerts into Grafana Alerting. Grafana OnCall routes them by severity to phone, SMS, or Mattermost, the team chat. Each alert includes a runbook link, so the responder opens the alert and sees the first action to take.

Uptime Kuma has its own alert path. It sends failed HTTPS checks to Mattermost and SMS without going through Grafana, and it serves the public status page from the same Lightsail instance. Heartbeat monitors page the on-call rotation when Prometheus, Loki, or Promtail (the agent that ships logs to Loki) stop reporting.
:::

---

## Implementation Highlights

- Terraform (infrastructure as code) provisions the whole stack: Prometheus, Grafana, Loki with Promtail DaemonSets, Metrics Server, Kube State Metrics, IRSA roles for S3 access, and the Lightsail instance for Uptime Kuma. IRSA (IAM roles for service accounts) gives a pod AWS permissions through a role, with no stored access keys.
- Dashboards cover cluster health, per-service request rate and latency, and ingress traffic by customer domain (per-host requests per second, p95 latency, 4xx/5xx ratios). Kiali renders the Istio workload graph and links graph edges to Jaeger traces.
- Jaeger collects spans from Istio's Envoy sidecar proxies, so a responder can open one trace and see which hop added the latency.
- Grafana signs users in through Keycloak, the company's single sign-on service, using OAuth2, and Keycloak groups map to Grafana org roles. Grafana OnCall runs a primary and backup rotation and escalates a page that nobody acknowledges within the target time.
- Each alert links to a runbook with commands, dashboards, owners, and rollback notes.

---

## Key Challenges & Solutions

### Challenge 1: Log Storage Cost at Cluster Scale

**Problem:** Kubernetes logs outgrew local disk within the first month. Keeping Loki storage on cluster volumes would have raised cost and made retention, the limit on how long logs are kept, harder to enforce.

**Solution:** I moved Loki chunks (the stored log data) and indexes to S3. Bucket lifecycle rules move older objects to cheaper storage classes and delete them after the retention window. I tuned chunk size and index periods to match the query patterns instead of keeping Loki's defaults.

:::success[Result]
Log storage costs dropped 70%, and recent logs stay fast to query.
:::

---

### Challenge 2: Alert Fatigue

**Problem:** The first alert set fired on spikes that did not affect customers. Engineers muted Mattermost, and real incidents arrived mixed in with false alarms.

**Solution:** I rebuilt the thresholds from the previous quarter of incidents. Critical alerts now page by phone and SMS, warnings go to Mattermost, and info alerts collect in a lower-priority feed. Silence windows mute alerts during planned work.

:::success[Result]
Alert volume fell 60%. The alerts that remain track customer impact more closely, and responders reach the right dashboard faster.
:::

---

### Challenge 3: Checking Customer Domains From Outside the Cluster

**Problem:** In-cluster monitoring only measures what happens inside the cluster. DNS mistakes, load balancer routing issues, and expired edge certificates can break the app for customers while Prometheus still reports the services as healthy.

**Solution:** I deployed Uptime Kuma on Lightsail, outside the EKS account and the cluster network. It probes each customer HTTPS domain, checks the response, and alerts through a separate Mattermost and SMS path. The public status page runs from the same instance.

:::success[Result]
Edge failures now page the on-call rotation within one probe interval. Customers can check the public status page instead of waiting for us to confirm an incident.
:::
