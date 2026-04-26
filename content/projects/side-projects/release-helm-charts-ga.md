---
title: Release Helm Charts - GitHub Action
tags: [GitHub Actions, Helm, CI/CD, Bash]
description: Composite GitHub Action that detects changed Helm charts, lints them, packages them, updates index.yaml, and publishes the chart repo to GitHub Pages.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/release-helm-charts) →

## Overview

### What it is
A reusable composite GitHub Action for publishing Helm charts to GitHub Pages. It detects changed charts, updates dependencies, runs `helm lint`, packages the chart, merges the repository index, and pushes the result to the Pages branch.

### Why it exists
I built it to understand how composite GitHub Actions and Helm chart repositories work under the hood. I also wanted one release step I could reuse across my own projects instead of copying the same Bash workflow into each repo.

The project maps well to DevOps work: release automation, Git branch handling, Helm packaging, and CI jobs that update generated artifacts without causing loops.

### Outcome

:::tip Key Results
- Published on the GitHub Marketplace
- Reusable composite action built with Bash, Helm, Git, and GitHub Actions
- Processes only changed charts
- Preserves older chart versions in `index.yaml`
- Publishes packaged charts to GitHub Pages
:::

---

## Tech Stack

**Automation:** GitHub Actions composite action  
**Packaging:** Helm  
**Publishing:** GitHub Pages  
**Scripting:** Bash, Git

---

## Implementation Setup

### Action Flow
The action runs a release workflow inside one GitHub Actions job:

1. Check out the source branch.
2. Check out the GitHub Pages branch into a separate directory.
3. Compare both trees to detect changed charts.
4. Run `helm dependency update` for each changed chart.
5. Run `helm lint`.
6. Package the chart with `helm package`.
7. Merge new packages into `index.yaml`.
8. Commit and push the generated chart repo to the Pages branch.

### Composite Action Structure
- Bash scripts handle branch paths, chart detection, packaging, and commits
- Helm commands handle dependency updates, linting, packaging, and index generation
- Git handles diffing, staged changes, commits, and pushes
- The action exposes inputs for chart path, source branch, Pages branch, and commit metadata

### Key Implementation Details
- **Dual checkout:** The workflow checks out the source branch at the workspace root and the Pages branch in a subdirectory.
- **Change detection:** The action compares the source checkout with the Pages checkout so it packages only modified charts.
- **Index merge:** `helm repo index --merge` keeps older chart versions installable.
- **No-op runs:** The commit step skips pushing when the action has no generated changes.
- **Marketplace packaging:** The repo includes action metadata so other workflows can call it as a reusable action.

---

## Key Challenges & Solutions

### Challenge 1: Preserving Chart Version History

**Problem:** A Helm repository index lists every chart version users can install. If the action regenerated `index.yaml` from only the latest package, older chart versions would disappear from the repo metadata.

**Solution:** The action keeps the existing `index.yaml` from the Pages branch and passes it to `helm repo index --merge`. Helm adds new packages while preserving existing entries.

:::success Result
Older chart versions stay installable after new releases.
:::

---

### Challenge 2: Avoiding Empty Commits

**Problem:** A workflow that commits generated artifacts can create noisy history when no chart changed. Empty commits also make it harder to tell which runs produced a real release.

**Solution:** The script checks for staged changes before committing. If Helm packaging and index generation produce no diff, the action exits without pushing.

:::success Result
Release history only changes when the action publishes chart artifacts.
:::
