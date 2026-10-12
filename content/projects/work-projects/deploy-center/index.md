---
title: DeployCenter - Multi-Tenant Kubernetes Deployment Platform
sidebar_position: 1
tags: [AWS, EKS, Kubernetes, ArgoCD, GitOps, Keycloak, Flask, React, Jinja2, GitHub Actions, CI/CD, CloudFront, S3]
description: Deployment platform I built for 20+ customer apps across 3 AWS regions. It cut per-app deploy time from 15 minutes to 3. I make batch changes from Git, developers deploy from a web dashboard, and both paths run the same Python orchestrator.
---

import Architecture from './images/architecture.svg';

## Overview

### What it is
DeployCenter is the platform I built at CraftSchoolship to deploy the apps we host for our customers, who are educational institutions. It supports Odoo (business management software), Moodle (an online learning platform), and Mattermost (team chat). Each customer app runs on Kubernetes in Amazon EKS, AWS's managed Kubernetes service, in one of 3 AWS regions. DeployCenter cut the time to deploy one app from about 15 minutes to 3.

I make infrastructure and batch changes myself by editing `customers.yaml`, a config file in Git. Product developers deploy apps day to day from a React dashboard. They sign in through Keycloak, the company's single sign-on service, and need no write access to the deployment repo. Both paths call the same Python orchestrator. I built all three pieces: the orchestrator, the Flask API behind the dashboard, and the React dashboard.

### Why it exists
Deploying one customer app used to take about 15 minutes by hand. An engineer wrote the Kubernetes manifests (YAML files that describe what Kubernetes runs), filled in Helm values (per-install settings for Helm, the Kubernetes package manager), created EFS volumes (AWS network file storage), added DNS records in Route 53 through the AWS console, then committed the generated files to Git. A typo in any step could break the deploy.

### Outcome

:::tip[Key Results]
- Per-app deploy time dropped from 15 minutes to 3
- 20+ customers run on it across 3 AWS regions
- Odoo, Moodle, and Mattermost deploy through the same code, and adding an app means adding its templates
- Git pushes and dashboard actions produce the same manifests
- A deploy that fails partway rolls back the resources it created
- Developers deploy through Keycloak roles, without write access to the deployment repo
:::

---

## Background

The first version used one repo, `customers.yaml`, a Python script, and a GitHub Actions workflow. I edited the YAML on `main`. The workflow rendered the manifests, created the AWS resources, and committed the generated files to one branch per customer. ArgoCD, a GitOps tool that keeps a cluster matching what a Git branch describes, synced those branches to the target clusters.

That flow worked for infrastructure-heavy changes. It slowed down the product developers, who needed to deploy customer apps but did not need write access to the repo. Training each of them on Git conflicts, YAML mistakes, and CI failures took more time than the deploys themselves.

I built DeployCenter on top of that automation and kept the Git path for batch work. I turned the Python script into an importable package, put a Flask API in front of it for authentication, input validation, rollback coordination, and a PostgreSQL audit trail of who did what, and built the React dashboard on top of that API. Keycloak roles control who can view, deploy, edit templates, or manage customers.

---

## Architecture

### Architecture Diagram

<figure className="diagram">
  <Architecture />
</figure>

### Deploy Flow

**Git-driven path:** I edit `customers.yaml` on `main`. GitHub Actions assumes an AWS role through OIDC, which gives the workflow short-lived AWS credentials so it needs no stored AWS keys. The workflow runs the orchestrator, which renders the manifests, provisions the AWS resources, and pushes the generated files to the customer's branch. ArgoCD detects the branch update and syncs the target cluster.

**Dashboard path:** a user signs in through Keycloak, chooses a customer and an app template, fills in the region-specific values, and clicks deploy. Flask validates the request, calls the same orchestrator, and writes audit records to PostgreSQL.

:::info[Key Components]
React dashboard (S3 + CloudFront) -> Flask API (EKS) -> Python orchestrator -> ArgoCD (multi-cluster) -> EKS clusters -> AWS (EFS, Route 53, S3)

Parallel path: GitHub Actions -> same Python orchestrator -> same downstream targets
:::

---

## Implementation Highlights

- The orchestrator renders manifests and Helm values from Jinja2 templates (a Python templating engine). The templates use custom `[[ ]]` delimiters so they don't clash with Helm's own `{{ }}` syntax. AWS, GitHub, and ArgoCD operations are idempotent (safe to run twice): they read before they create and write only when the content changed. Calls to ArgoCD back off exponentially when it returns HTTP 429 (rate limited).
- Two GitHub Actions workflows drive the Git path. One renders and provisions when `customers.yaml` changes. The other merges `main` into the customer branches, so template updates reach existing customers without anyone editing their config.
- Each customer maps to one AWS region: `us-west-2` (Oregon), `eu-south-2` (Spain), or `eu-west-3` (Paris). The orchestrator caches one Boto3 (AWS SDK for Python) client per region, and Route 53 weighted records distribute traffic across regional endpoints.
- Flask validates the login tokens (JWTs) that Keycloak issues, stores customers, deployments, and audit records in PostgreSQL, and coordinates rollback when a deploy fails partway.

---

## Key Challenges & Solutions

### Challenge 1: One Deploy Engine Behind Git and the Dashboard

**Problem:** We still needed `customers.yaml` for batch changes, but developers needed a UI for day-to-day deploys. Two separate implementations would mean making every template change, AWS fix, and ArgoCD update twice.

**Solution:** I moved the deployment logic into a Python package with no Flask or GitHub Actions dependency. The CI workflow imports it, and the Flask backend imports it. Both call the same `deploy_customer_app()` entrypoint with the same input shape.

:::success[Result]
Git pushes and dashboard actions run the same rendering, provisioning, and ArgoCD code, so a template change is made once.
:::

---

### Challenge 2: Rolling Back a Deploy That Fails Partway

**Problem:** One deployment touches EFS, Route 53, Git commits, ArgoCD projects, and ArgoCD applications. A failure partway through could leave EFS volumes, DNS records, or commits pointing at infrastructure the platform never finished creating.

**Solution:** I wrapped the sequence in a coordinator that records each resource it creates. External calls retry on transient failures. If a later step fails, the coordinator goes through the created-resource list in reverse, deletes what it created, reverts the Git commit, and removes the partial ArgoCD app.

:::success[Result]
A failed deploy leaves nothing to clean up by hand. The team can retry it from GitHub Actions or the dashboard.
:::

---

### Challenge 3: Standard Templates With Customer Overrides

**Problem:** Customers needed different values for the same app: replica counts, SMTP settings, storage classes, domains, and feature flags. A separate copy of the template for each customer would mean applying every upgrade to each copy.

**Solution:** I designed templates as base files plus customer overrides. The base template contains the standard Helm values and manifests. `customers.yaml` or the dashboard provides only the customer-specific keys. The renderer merges those keys into the base before writing the final manifests.

:::success[Result]
Three base app templates serve 20+ customers. Adding a customer takes one entry in `customers.yaml` or one dashboard submission.
:::
