---
title: DeployCenter - Multi-Tenant Kubernetes Deployment Platform
tags: [AWS, EKS, Kubernetes, ArgoCD, GitOps, Keycloak, Flask, React, Jinja2, GitHub Actions, CI/CD, CloudFront, S3]
description: Internal deployment platform for customer apps on multi-region EKS. Git and dashboard deploys share the same automation.
---

## Overview

### What it is
DeployCenter provisions customer applications on multi-region EKS clusters. It supports Odoo, Moodle, and Mattermost today, and a new app starts with a template set rather than a new deployment workflow.

Infrastructure changes can go through `customers.yaml`. App deploys can also go through a React dashboard that talks to Flask. Both paths call the same Python orchestration package.

### Why it exists
Deploying one customer app used to take about 15 minutes. An engineer wrote Kubernetes manifests, filled Helm values, created EFS volumes, added Route53 records in the AWS console, then committed generated files to Git. A typo in any step could break the deploy.

We needed a Git path for batch changes and a dashboard path for day-to-day app deploys, without giving everyone write access to the deployment repo.

### Outcome

:::tip Key Results
- Per-app deploy time dropped from 15 minutes to 3
- 20+ customers run across 3 AWS regions
- Odoo, Moodle, and Mattermost share the same deployment engine
- Git pushes and dashboard actions produce the same manifests
- Keycloak SSO maps users to viewer, deployer, and admin roles
- Idempotent AWS, GitHub, and ArgoCD operations support safe retries
:::

---

## Background

The first version used one repo, `customers.yaml`, a Python script, and a GitHub Actions workflow. Engineers edited YAML on `main`. The workflow rendered manifests, created AWS resources, and committed generated files to per-customer branches. ArgoCD synced those branches to the target clusters.

That flow worked for infrastructure-heavy changes. It slowed down developers who needed to deploy customer apps but did not need repo write access. Training each person on Git conflicts, YAML mistakes, and CI failures cost more time than the deployment itself.

I built DeployCenter on top of the existing automation. The Python script became an importable package. Flask added auth, validation, rollback coordination, and a PostgreSQL audit trail. React gave the rest of the team a controlled deploy flow. Keycloak roles decide who can view, deploy, edit templates, or manage customers.

The Git path still exists for batch work, and the dashboard handles one-off deploys. Both routes share one renderer and one provisioning path.

---

## Architecture

### Architecture Diagram

![DeployCenter Architecture](./images/deploy-center/arch.png)

### Deploy Flow

Both entry points call the same Python orchestration core.

**Git-driven path:** an engineer edits `customers.yaml` on `main`. GitHub Actions assumes an AWS role through OIDC, runs the orchestrator, renders manifests, provisions AWS resources, and pushes generated files to customer branches. ArgoCD detects the branch update and syncs the target cluster.

**Dashboard path:** a user signs in through Keycloak, chooses a customer and app template, fills region-specific values, and clicks deploy. Flask validates the request, calls the same orchestrator, and writes audit records to PostgreSQL.

:::info Key Components
React dashboard (S3 + CloudFront) -> Flask API (EKS) -> Python orchestrator -> ArgoCD (multi-cluster) -> EKS clusters -> AWS (EFS, Route53, S3)

Parallel path: GitHub Actions -> same Python orchestrator -> same downstream targets
:::

---

## Tech Stack

**Backend:** Python 3.10, Flask, PostgreSQL, Jinja2, Boto3, GitPython  
**Frontend:** React, S3, CloudFront  
**Authentication:** Keycloak, OAuth2, RBAC  
**GitOps:** ArgoCD, Helm, GitHub  
**Cloud:** AWS, EKS, EFS, Route53, S3, IAM OIDC  
**CI/CD:** GitHub Actions, Docker, Helm rollouts

---

## Implementation Setup

### Orchestration Core
I extracted the deployment logic into a Python package that both entry points import:
- Renders Kubernetes manifests and Helm values from Jinja2 templates
- Uses custom Jinja2 delimiters (`[[ ]]`) to avoid conflicts with Helm syntax
- Provisions EFS file systems and Route53 weighted A records through Boto3
- Caches AWS clients and lookups so repeat runs avoid extra API calls
- Calls the ArgoCD REST API with exponential backoff on 429 and 5xx responses
- Commits generated manifests to per-customer branches through GitPython
- Treats operations as idempotent: read before create, write only when content changes

### Flask Backend
- Validates Keycloak JWTs on each request
- Checks role claims against endpoint permissions
- Stores customers, deployments, templates, and audit records in PostgreSQL
- Exposes REST endpoints for the React dashboard
- Wraps the orchestrator so one API call can coordinate AWS, GitHub, and ArgoCD work
- Rolls back failed deploys by deleting created AWS resources, reverting the Git commit, and removing the partial ArgoCD app

### React Dashboard
- Keycloak OAuth2 with authorization code flow and PKCE
- Customer CRUD with form validation
- Deployment wizard for customer, app template, region, and app values
- ArgoCD sync status pulled from the Flask API
- PostgreSQL-backed audit log
- Template editor for admins who need to update Jinja2 sources without opening the repo

### Git-Driven Path
Two GitHub Actions workflows handle the repo-first interface.

The deploy workflow runs when `customers.yaml` changes. It assumes an AWS IAM role through OIDC, runs the orchestrator, and pushes generated manifests to the matching customer branches.

The sync workflow runs when templates or orchestrator code change on `main`. It merges `main` into customer branches so template updates reach existing customers without re-editing `customers.yaml`.

### Template System
Templates live in the repo as Jinja2 files. Each app ships with:
- Helm values for the workload
- ArgoCD Application JSON for GitOps
- Dependency manifests such as PostgreSQL and Redis

Odoo, Moodle, and Mattermost use the same template contract. A new app gets its own template directory; the orchestrator discovers it without code changes.

Customers set overrides through `customers.yaml` or the dashboard form. The renderer merges first-level keys into the base template, so one base template can serve different replica counts, storage classes, SMTP settings, and app-specific values.

### Multi-Region Deployment
Each customer maps to one AWS region: US-WEST-2, EU-SOUTH-2, or EU-WEST-3. The orchestrator loads the region config on demand, caches Boto3 clients per region, and sends each AWS call to the correct account and region settings. Route53 weighted records distribute traffic across regional endpoints.

### CI/CD Pipelines

**Backend:** PR tests -> Docker build -> ECR push -> Helm upgrade on EKS with rolling updates.

**Frontend:** React build -> S3 sync -> CloudFront invalidation. Versioned build artifacts make rollback a single deploy command.

**Customer deployments:** GitHub Actions for the Git path, Flask API for the dashboard path. Both produce the same branch layout and manifest content.

---

## Key Challenges & Solutions

### Challenge 1: Two Entry Points Without Two Deploy Systems

**Problem:** We still needed `customers.yaml` for batch changes, but developers needed a UI for day-to-day deploys. Two separate implementations would force every template change, AWS fix, and ArgoCD update through two code paths.

**Solution:** I moved the deployment logic into a Python package with no Flask or GitHub Actions dependency. The CI workflow imports it, and the Flask backend imports it. Both call the same `deploy_customer_app()` entrypoint with the same input shape.

:::success Result
Git pushes and dashboard actions use the same renderer, provisioning code, and ArgoCD calls. Template changes ship once.
:::

---

### Challenge 2: Coordinating AWS, GitHub, and ArgoCD Without Orphans

**Problem:** One deployment touches EFS, Route53, Git commits, ArgoCD projects, and ArgoCD applications. A mid-flight failure could leave EFS volumes, DNS records, or commits that pointed at infrastructure the platform never finished creating.

**Solution:** I wrapped the sequence in a coordinator that records each created resource. External calls use retry logic for transient failures. If a later step fails, the coordinator walks the created-resource list backward, deletes what it created, reverts the Git commit, and removes the partial ArgoCD app.

:::success Result
Failed deploys no longer leave manual cleanup work. The team can retry from GitHub Actions or the dashboard.
:::

---

### Challenge 3: Permissions Across Git and Dashboard Paths

**Problem:** Developers needed read access and one-off deploys. Infrastructure changes and template edits needed tighter permissions than broad repository write access.

**Solution:** Keycloak roles (`viewer`, `deployer`, `admin`) map to JWT claims. Flask middleware checks those claims on protected endpoints. React hides unavailable actions, and Flask rejects crafted requests that bypass the UI. The Git path uses GitHub branch protection on `main` and required reviewers for `customers.yaml`.

:::success Result
The dashboard has role-based access, and the Git path keeps branch protection. Developers can deploy approved templates without repo write access.
:::

---

### Challenge 4: Standard Templates With Customer Overrides

**Problem:** Customers needed different values for the same app: replica counts, SMTP settings, storage classes, domains, and feature flags. A template fork per customer would make upgrades painful.

**Solution:** I designed templates as base files plus customer overrides. The base template contains the standard Helm values and manifests. `customers.yaml` or the dashboard provides only the customer-specific keys. The renderer merges those keys into the base before writing the final manifests.

:::success Result
Three base app templates serve 20+ customers. A new customer needs a YAML entry or dashboard submission, not a template fork.
:::
