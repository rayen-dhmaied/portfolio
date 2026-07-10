---
title: Manage GitHub Org Permissions - GitHub Action
sidebar_position: 1
tags: [Python, PyGithub, GitHub Actions, GitHub App, GitHub API, IaC, YAML]
description: GitHub Action on the Marketplace that puts org access changes behind pull requests. Teams, repo permissions, and collaborators sync from one YAML file, authenticated as a GitHub App.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/manage-gorg-permissions) →

## Overview

### What it is
A GitHub Action that manages organization permissions from code. A `gorg.yaml` file defines the teams, repository permissions, and direct collaborators the action should manage. The workflow authenticates as a GitHub App, compares GitHub's current state with the YAML file, and applies the difference.

The action manages only the resources named in `gorg.yaml`. It does not create or delete teams or repositories, and it leaves anything outside the file untouched. After each run, it writes a `gorg.md` report back to the repo with the applied state.

### Why it exists
GitHub permissions drift when teams move fast. Someone adds a contractor for one review, a repo gets a direct collaborator, and a few months later no one knows which access still belongs there.

I built this so access changes go through pull requests. The YAML file holds the desired state, and the generated report shows what the action applied.

### Outcome

:::tip Key Results
- Published on the GitHub Marketplace
- Access changes go through pull requests: one YAML file holds teams, repo permissions, and collaborators
- GitHub App auth with short-lived installation tokens instead of a personal access token
- Manages only what the YAML names, so an org can adopt it one repo at a time
- A committed report records the applied state after each sync
:::

A `gorg.yaml` looks like:

```yaml
organization: acme-corp

teams:
  platform:
    maintainers: [alice]
    members: [bob, carol]

repos:
  payments-api:
    teams:
      platform: write
    users:
      external-auditor: triage
```

The repo README covers setup, inputs, and the behavior matrix.

---

## Implementation Highlights

The action runs in three phases. `load_config` validates `gorg.yaml` before any API call and rejects unknown permission values. `Auth.AppInstallationAuth` exchanges the App credentials for a short-lived installation token. The reconciler then compares current and desired state for each managed team and repository and applies the difference. One guard blocks the action from managing the repository that runs it, so a bad config cannot strip the action's own access.

Design decisions:
- **Direct collaborators only:** the sync lists repo collaborators with `affiliation='direct'`. Without that filter, GitHub also returns team-inherited users and the sync would fight itself.
- **Missing resources:** a missing team or repo named in YAML logs a warning and the run continues. Other API errors fail the sync.
- **Tolerant optional fields:** a `_coerce` helper treats missing optional fields as empty lists, so `members:` and no `members` key behave the same.
- **Rate limits:** if the GitHub API rate limit stops a run mid-sync, the action still writes the report and exits non-zero so the workflow fails visibly.
- **Loop safety:** the workflow trigger watches `gorg.yaml`, not the generated report, and a concurrency group stops overlapping syncs.

---

## Key Challenges & Solutions

### Challenge 1: Auth Without a Long-Lived PAT

**Problem:** A permissions sync needs organization-level access. A personal access token ties changes to one user, adds rotation risk, and can carry broader permissions than the workflow needs.

**Solution:** I used a GitHub App. The action exchanges the App private key and installation ID for a short-lived token during each run. GitHub scopes the token to the App installation and records changes under the App identity.

:::success Result
The workflow runs without a long-lived user token, and GitHub audit logs attribute changes to the App.
:::

---

### Challenge 2: Adopting the Tool Without Owning the Whole Org

**Problem:** Teams often have legacy repos, bot accounts, and one-off collaborators. A tool that removes everything not listed in YAML is too risky for a first run.

**Solution:** The reconciler manages only teams and repos named in `gorg.yaml`. Inside that managed set, the YAML file is the source of truth. Outside it, the action leaves GitHub state alone.

:::success Result
Users can start with one team or repository and expand coverage over time.
:::

