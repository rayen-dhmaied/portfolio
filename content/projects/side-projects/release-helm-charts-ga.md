---
title: Release Helm Charts - GitHub Action
tags: [GitHub Actions, Helm, CI/CD, Bash]
description: A reusable GitHub Action that lints, packages, and publishes Helm charts to GitHub Pages in one workflow step.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/release-helm-charts) →

## Overview

### What it is
A reusable GitHub Action that publishes Helm charts to GitHub Pages.

### Why it exists
I wanted to understand how composite GitHub Actions and Helm repositories work, so I built one. It ships charts on every project of mine that needs a Helm repo.

### Outcome

:::tip Key Results
- Published on the GitHub Marketplace
- In use across my own projects that publish Helm charts
- Composite action built from bash, with no external dependencies
:::

---

## Tech Stack

**GitHub Actions** (composite), **Helm**, **GitHub Pages**, **Bash**, **Git**

---

## Implementation Setup

### Action Structure
Composite action driven by bash scripts:
- Git operations for branch management and change detection
- Helm commands for dependency updates, linting, and packaging
- Index generation through `helm repo index`

### Workflow
1. Check out the source branch and the GitHub Pages branch separately
2. Diff the two branches to find modified charts
3. Update chart dependencies
4. Lint and package changed charts
5. Update or create `index.yaml`
6. Commit and push to the GitHub Pages branch

### Key Implementation Details
- **Dual checkout:** source branch at workspace root, Pages branch in a subdirectory
- **Change detection:** git diff between the two checkouts, so only modified charts are processed
- **Index merging:** existing chart versions are preserved when new releases are added

---

## Key Challenges & Solutions

### Challenge 1: Managing Two Branches in One Job

**Problem:** The action needs to compare the source branch against the GitHub Pages branch and then update the Pages branch. A single `actions/checkout` overwrites the workspace, so a second checkout would clobber the first.

**Solution:** Run `actions/checkout` twice with different `path` parameters. Source branch sits at the workspace root, Pages branch sits in a subdirectory. `git diff` between them turns up the modified charts.

:::success Result
Both branches are available in the same job, with no branch switching or stashing.
:::

---

### Challenge 2: Preserving Chart Version History

**Problem:** A Helm repository's `index.yaml` lists every chart version available. Regenerating it from scratch on each release would drop every previous version.

**Solution:** Copy the existing `index.yaml` from the Pages branch before regenerating. `helm repo index --merge` folds new packages in alongside the existing entries.

:::success Result
Older versions stay installable after every release.
:::
