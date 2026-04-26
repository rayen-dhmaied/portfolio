---
title: Manage GitHub Org Permissions - GitHub Action
tags: [Python, PyGithub, GitHub Actions, GitHub App, GitHub API, IaC, YAML]
description: GitHub Action that syncs organization teams, repository permissions, and collaborators from YAML using a GitHub App and short-lived installation tokens.
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
- One YAML file defines managed teams, repo permissions, and direct collaborators
- GitHub App auth avoids long-lived personal access tokens
- Short-lived installation tokens scope each run to the App installation
- `gorg.md` report records the applied state after each sync
- Incremental adoption: unmanaged teams and repos stay untouched
- Published on the GitHub Marketplace
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

## Tech Stack

**Runtime:** Python, PyGithub  
**Automation:** GitHub Actions  
**Auth:** GitHub App, installation access tokens  
**API:** GitHub REST API  
**Config:** YAML

---

## Implementation Notes

The action runs in three phases.

### 1. Load and Validate
`load_config` parses `gorg.yaml` before any GitHub API call. It rejects unknown permission values, malformed YAML, and unsafe config.

One guard blocks the action from managing the repository that runs it. That prevents a bad config from stripping the action's own access and breaking future syncs.

### 2. Authenticate as a GitHub App
The workflow passes the App ID, private key, and installation ID into the action. `Auth.AppInstallationAuth` exchanges them for a short-lived installation access token at runtime.

The private key input accepts either a path to a `.pem` file or inline key content with `\n` escapes, which makes the action easier to run in different CI setups.

### 3. Reconcile Permissions
For each managed team, the action compares current and desired maintainers and members, then applies the changes. For each managed repository, it reconciles team permissions and direct collaborators.

If the GitHub API rate limit stops the run mid-sync, the action still writes the report and exits non-zero so the workflow fails visibly.

### Design Decisions

- **Direct collaborators only:** The action lists repo collaborators with `affiliation='direct'`. Without that filter, GitHub also returns users who inherit access through teams, and the sync would fight itself.
- **Missing resources:** A missing team or repo named in YAML logs a warning and the run continues. Other API errors fail the sync.
- **Tolerant optional fields:** A `_coerce` helper treats missing optional fields as empty lists, so `members:` and no `members` key behave the same.
- **Report commits:** The workflow commits `gorg.md` only when the generated report changes.
- **Concurrency:** A `gorg-sync` concurrency group prevents two pushes from reconciling the org at the same time.

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

---

### Challenge 3: Generated Reports Without Workflow Loops

**Problem:** The action commits `gorg.md` after a sync. If that commit triggers the workflow again, the action can enter a commit loop and burn API rate limit.

**Solution:** The workflow trigger watches `gorg.yaml`, not `gorg.md`. The commit step checks for staged changes before pushing, and the workflow uses the `gorg-sync` concurrency group to avoid overlapping syncs.

:::success Result
The report stays current without retriggering the workflow.
:::
