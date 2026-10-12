---
title: Scalable BigBlueButton on AWS
sidebar_position: 3
tags: [AWS, EC2, EKS, CloudFormation, Helm, Auto Scaling, Prometheus, Grafana, Loki]
description: A video conferencing platform I designed and built on AWS at CraftSchoolship, running the open-source BigBlueButton software as an auto-scaling fleet. A custom machine image cut server launch time from 11 minutes to 3, and scale-in protection keeps live meetings running while the fleet shrinks.
---

import Architecture from './images/architecture.svg';

## Overview

### What it is
BigBlueButton is open-source video conferencing software for online classes. At CraftSchoolship, I designed and built the whole platform that runs it on AWS, a fleet of servers that grows and shrinks with load, from the infrastructure and scaling rules to the machine image, the server scripts, recording storage, and monitoring.

Each server is an EC2 virtual machine in an Auto Scaling Group that spans multiple Availability Zones (AZs, separate AWS data centers in one region). Scalelite, an open-source load balancer for BigBlueButton, sends each meeting to one server. Recordings go to Amazon EFS, a network file system that every server mounts, so any server can write them and Scalelite serves them from one address.

I deployed the AWS infrastructure with CloudFormation templates and installed Scalelite and Greenlight (BigBlueButton's web app for meeting rooms) on Amazon EKS, AWS's managed Kubernetes, with Helm charts. Prometheus and Loki collect metrics and logs from the fleet, and Grafana shows them in dashboards.

### Why it exists
BigBlueButton keeps each live meeting on one server and writes its recordings to that server's disk. One server limits how many people can meet at once, and if it fails, its recordings can be lost.

The platform needed more capacity without ending live meetings or losing recordings when servers are removed, and without engineers registering each new server by hand.

### Outcome

:::tip[Key Results]
- New server launch time dropped from 11 minutes to 3 with a custom Amazon Machine Image (AMI), a server image with BigBlueButton preinstalled
- Scale-in (removing servers when load drops) no longer ends live meetings, because servers hosting a meeting are protected from termination
- Recordings stay available when servers are removed or replaced, because every server and Scalelite share one EFS volume
- New servers create their own DNS record and TLS certificate and register with Scalelite at boot, with no manual steps
:::

---

## Architecture

### High-Level Flow

<figure className="diagram">
  <Architecture />
</figure>

:::info[Key Components]
Users open a meeting from Greenlight or from a learning management system (LMS), which sends them to Scalelite. Scalelite picks one BigBlueButton server from the Auto Scaling Group and sends the meeting there. Every server and Scalelite mount the same EFS volume, so recordings stay reachable when servers are added or removed.
:::

---

## Implementation Highlights

- The Auto Scaling Group adds servers when the lowest CPU in the fleet passes 80%, which means every server is above 80%, and removes them below 6%. Scheduled scaling adds servers before planned webinars and exams. CloudFormation rolling updates keep old servers running until the new ones pass health checks.
- On each server, systemd services run the launch and shutdown scripts. The scripts manage the Route53 DNS record, the BigBlueButton and TURN settings (TURN relays audio and video for users behind strict firewalls), Scalelite registration, the EFS mount, and the monitoring agents.
- Prometheus finds new servers through EC2 service discovery, bbb-exporter reports meeting and participant counts to Prometheus, and Promtail ships each server's logs to Loki behind an internal load balancer.
- A command-line tool handles the stack lifecycle. It validates, creates, updates, and deletes the CloudFormation stacks, and syncs the templates and boot scripts to S3.

---

## Key Challenges & Solutions

### Challenge 1: Slow Instance Launch Times

**Problem:** The first version took 11 minutes to launch one server. The boot script installed BigBlueButton, its dependencies, certificates, and configuration from scratch, so Auto Scaling could not add servers fast enough during traffic spikes.

**Solution:** I built a custom AMI with BigBlueButton and its dependencies preinstalled. The boot script now handles only per-server setup: hostname, DNS, certificates, Scalelite registration, the EFS mount, and monitoring agents.

:::success[Result]
Launch time dropped from 11 minutes to 3, which is fast enough for the Auto Scaling Group to add servers during real load spikes.
:::

---

### Challenge 2: Meeting Disruptions During Scale-In

**Problem:** Auto Scaling could terminate a server that still hosted a live meeting, and everyone in that meeting would lose the session.

**Solution:** On each server, a systemd timer asks the BigBlueButton API whether any meetings are active and turns the server's scale-in protection on or off to match. Scale-in protection is an Auto Scaling setting that stops the group from terminating that server. Because scale-in only starts below 6% CPU, idle servers are the first candidates for removal.

:::success[Result]
The fleet still shrinks after traffic falls, and scale-in no longer drops live meetings.
:::

---

### Challenge 3: Dynamic DNS and Server Registration

**Problem:** Each new BigBlueButton server needs a DNS record, a TLS certificate, and Scalelite registration before it can receive meetings. Doing this by hand does not work when the Auto Scaling Group adds and removes servers on its own.

**Solution:** The launch and shutdown scripts handle the whole server lifecycle. On launch, the server creates its Route53 A record, requests a Let's Encrypt certificate, mounts EFS, and registers with Scalelite using a shared secret. On shutdown, it deregisters from Scalelite and deletes its DNS record.

:::success[Result]
New servers join the meeting pool with DNS, TLS, shared storage, and Scalelite registration in place by the time the boot script finishes.
:::
