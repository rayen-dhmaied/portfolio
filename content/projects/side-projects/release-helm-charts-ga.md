---
title: Release Helm Charts - GitHub Action
sidebar_position: 2
tags: [GitHub Actions, Helm, CI/CD, Bash]
description: Composite GitHub Action on the Marketplace that releases Helm charts to GitHub Pages. Detects changed charts, lints, packages, and merges index.yaml without losing old versions.
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
- One reusable release step: detect changed charts, lint, package, publish to GitHub Pages
- Older chart versions stay installable after each release
- No-op runs make no commits, so release history stays clean
:::

---

## Implementation Highlights

The action runs one job: check out the source branch and the Pages branch side by side, diff the two trees to find changed charts, then run `helm dependency update`, `helm lint`, and `helm package` on each one before merging the result into `index.yaml` and pushing to the Pages branch.

Inputs cover the chart path, source branch, Pages branch, and commit metadata, and the repo ships Marketplace action metadata so other workflows can reuse it.

---

## Key Challenges & Solutions

### Challenge 1: Preserving Chart Version History

**Problem:** A Helm repository index lists every chart version users can install. If the action regenerated `index.yaml` from only the latest package, older chart versions would disappear from the repo metadata.

**Solution:** The action keeps the existing `index.yaml` from the Pages branch and passes it to `helm repo index --merge`. Helm adds new packages while preserving existing entries.

:::success Result
Older chart versions stay installable after new releases.
:::

