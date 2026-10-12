---
title: Manage GitHub Org Permissions - GitHub Action
sidebar_position: 1
tags: [Python, PyGithub, GitHub Actions, GitHub App, GitHub API, IaC, YAML]
description: GitHub Action on the GitHub Marketplace that manages a GitHub organization's teams, repository permissions, and collaborators from one YAML file, so every access change goes through a reviewed pull request.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/manage-gorg-permissions) →

## Overview

### What it is
A GitHub Action that manages who has access to what in a GitHub organization, from one YAML file in a repository. A GitHub Action is a reusable step that runs inside GitHub's built-in automation. I built this one and published it on the GitHub Marketplace, GitHub's public catalog of actions. It is for the people who administer a GitHub organization, such as a platform or DevOps team.

The file, `gorg.yaml`, defines the teams and their members, the permission each team and user has on each repository, and the direct collaborators (people given access to a repository individually instead of through a team). On each run, the action authenticates as a GitHub App, compares GitHub's current state with the file, and applies the difference. It then commits a `gorg.md` report to the repo with the state it applied.

### Why it exists
In a GitHub organization, admins add access by hand as people need it, for example a contractor for one review or a direct collaborator on one repo. A few months later, no one knows which of that access is still needed.

I built this action so access changes go through pull requests (proposed changes that a teammate reviews before they are merged). The Git history shows who changed which access and when, and the `gorg.md` report shows what the action applied.

### Outcome

:::tip[Key Results]
- Published on the GitHub Marketplace
- Access changes go through pull requests, and one YAML file holds teams, repository permissions, and collaborators
- Authenticates as a GitHub App with a short-lived token per run, so the workflow needs no personal access token
- Manages only what the YAML names, so an organization can adopt it one repository at a time
- Commits a report of the applied state after each sync
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

This example makes alice a maintainer and bob and carol members of the `platform` team. It gives that team write access to `payments-api`, and gives the user `external-auditor` triage access to the same repo, which lets them manage issues and pull requests without pushing code.

The [repo README](https://github.com/rayen-dhmaied/manage-gorg-permissions) covers setup, the action's inputs, and the behavior matrix, which lists what the action does in each case.

---

## Implementation Highlights

The action is written in Python and runs in three phases. First, `load_config` validates `gorg.yaml` before any API call and rejects unknown permission values. Then `Auth.AppInstallationAuth`, from PyGithub (the Python client library for the GitHub API), exchanges the App credentials for a short-lived installation token. Last, the reconciler compares current and desired state for each managed team and repository and applies the difference. A separate guard stops the action from managing the repository it runs in, so a bad config cannot remove the action's own access.

Design decisions:
- **Direct collaborators only:** the sync lists repo collaborators with `affiliation='direct'`. Without that filter, GitHub also returns users who get access through a team, and the sync would treat them as unlisted collaborators and try to remove access their team grants.
- **Missing resources:** if a team or repo named in the YAML does not exist on GitHub, the action logs a warning and continues with the rest. Any other API error fails the sync.
- **Optional fields:** a `_coerce` helper treats missing optional fields as empty lists, so `members:` with no value and no `members` key at all behave the same.
- **Rate limits:** if GitHub's API rate limit (its cap on API requests) stops a run partway, the action still writes the report and exits with a non-zero code, so the workflow run shows as failed.
- **No trigger loops:** the action commits `gorg.md` back to the repo, so the workflow triggers only on changes to `gorg.yaml`. If it also triggered on the report, each report commit would start another run. A concurrency group, a GitHub Actions setting that allows one run at a time per group, stops syncs from overlapping.

---

## Key Challenges & Solutions

### Challenge 1: Authentication Without a Long-Lived Personal Access Token

**Problem:** A permissions sync needs organization-level access. A personal access token (PAT) is tied to one user's account, so every change shows up as that user's. It also has to be rotated by hand and can carry broader permissions than the workflow needs.

**Solution:** I used a GitHub App, which is an integration with its own identity and its own permissions, separate from any person's account. On each run, the action exchanges the App's private key and installation ID (the ID of the App's install on the organization) for a short-lived token. GitHub limits that token to the permissions granted to the App installation and records changes under the App's name.

:::success[Result]
The workflow runs without a long-lived user token, and GitHub audit logs attribute changes to the App.
:::

---

### Challenge 2: Adopting the Tool Without Managing the Whole Org

**Problem:** Organizations often have legacy repos, bot accounts, and one-off collaborators. A tool that removes everything not listed in the YAML is too risky for a first run.

**Solution:** The reconciler manages only the teams and repos named in `gorg.yaml` and does not create or delete teams or repositories. For the teams and repos it manages, the action sets access on GitHub to match the YAML file. Everything outside the file stays as it is.

:::success[Result]
An organization can start with one team or repository and add more over time.
:::
