---
title: Manage GitHub Org Permissions - GitHub Action
tags: [Python, PyGithub, GitHub Actions, GitHub App, GitHub API, IaC, YAML]
description: A GitHub Action that syncs an organisation's teams, repo permissions, and direct collaborators from a YAML file. Push to `main`, and a GitHub App reconciles GitHub's actual state against the desired state.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/manage-gorg-permissions) →

## Overview

### What it is
A GitHub Action that treats organisation permissions as code. You write a single `gorg.yaml` describing the teams, repo access, and direct collaborators you want; the action authenticates as a GitHub App and reconciles GitHub's actual state against the file. A `gorg.md` report is committed back so the repo always shows what's currently applied.

The action manages access only. It does not create or delete teams or repos, and anything not listed in `gorg.yaml` is left alone.

### Why it exists
Org permissions on GitHub drift. Someone adds a contractor to a team for one PR, a repo's collaborator list grows by hand, and a few months later the actual state of the org has diverged from what anyone remembers granting. Putting permissions in a YAML file under version control means changes get reviewed in pull requests and `git blame` answers who changed what.

### Outcome

:::tip Key Results
- One YAML file describes every managed team, repo permission, and direct collaborator
- GitHub App auth, so there's no PAT to rotate and the audit trail attributes changes to the app, not a person
- Auto-generated `gorg.md` report committed back as a record of applied state
- Adoption is incremental: anything not listed in `gorg.yaml` is untouched
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

Full setup, action inputs, and the behaviour matrix live in the [repo README](https://github.com/rayen-dhmaied/manage-gorg-permissions).

---

## Tech Stack

**Python** (PyGithub), **GitHub Actions**, **GitHub App** (auth), **GitHub REST API**, **YAML**

---

## Implementation Notes

The action is a Python script built on [PyGithub](https://github.com/PyGithub/PyGithub) and runs in three phases:

1. **Load and validate.** `load_config` parses `gorg.yaml`, rejects unknown permission values or malformed YAML before any API call, and refuses to run if the action's own repo appears in the `repos` section (so a bad commit can't strip the action from the repo running it).
2. **Authenticate as a GitHub App.** `Auth.AppInstallationAuth` exchanges the App ID, private key, and installation ID for a short-lived installation access token. The private-key env var accepts either a path to a `.pem` file or the inline content with `\n` escapes.
3. **Reconcile.** For each managed team, diff current and desired membership and apply the changes. For each managed repo, do the same for team access and direct collaborators. If the API rate limit is hit mid-sync, the workflow still writes the report and exits non-zero.

Decisions worth calling out:
- **`affiliation='direct'` when listing repo collaborators.** Without this, GitHub also returns users who got access via a team. The action would treat them as extra and remove them, the team sync would re-add them, and the next run would loop the same way.
- **404 vs other errors.** A team or repo named in YAML but missing on GitHub logs at warning level and the sync continues. Anything else from the API is treated as a real error.
- **Tolerant YAML parsing.** A `_coerce` helper treats missing or wrong-typed optional fields as empty, so an empty `members:` key under a team behaves the same as no key at all.

---

## Key Challenges & Solutions

### Challenge 1: Auth Without a Long-Lived PAT

**Problem:** A reconciliation tool that touches org-level admin endpoints needs strong credentials. A personal access token works, but it ties every change to one human account, expires on the worst possible day, and tends to carry more permissions than the action needs.

**Solution:** The action authenticates as a GitHub App. It exchanges the App's private key and installation ID for a short-lived installation access token at runtime. Permissions are bounded by what the App was granted on install (Administration, Members), so the blast radius lives in the App definition rather than in a person's account.

:::success Result
No long-lived secret in CI. The audit trail in GitHub points at the App on every change.
:::

---

### Challenge 2: Adopting the Tool Without Inventorying the Whole Org

**Problem:** An all-or-nothing reconciliation tool is hard to adopt. Most orgs have legacy teams, dotted-line collaborators, and bot accounts that no one wants to enumerate before flipping a switch. If the first run removed everything not listed in YAML, no one would run it twice.

**Solution:** The reconciler only manages resources that are explicitly named in `gorg.yaml`. Teams and repos not listed are ignored. Within a managed team or repo, members not listed are removed; outside the managed set, nothing is touched. Adoption can grow one team at a time.

:::success Result
A first run on a fresh `gorg.yaml` only changes resources the user opted into. Onboarding the next team is a YAML edit.
:::

---

### Challenge 3: Auto-Committed Reports Without Self-Triggering

**Problem:** The workflow commits a generated `gorg.md` back to `main` so the repo shows the latest applied state. Without care, that commit re-fires the workflow, which produces another commit, and the loop runs until the rate limit catches it.

**Solution:** Two safeguards. The push trigger filters on `paths: [gorg.yaml]`, so a commit that only touches `gorg.md` doesn't fire the workflow. The commit step uses `git diff --cached --quiet` to skip pushing when there's nothing to commit. A `concurrency` group named `gorg-sync` keeps two pushes from racing each other through the API.

:::success Result
The report stays current in the repo and the workflow does not retrigger itself.
:::
