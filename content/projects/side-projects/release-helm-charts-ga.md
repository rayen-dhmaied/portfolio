---
title: Release Helm Charts - GitHub Action
tags: [GitHub Actions, Helm, CI/CD, Bash]
description: Reusable GitHub Action automating Helm chart releases to GitHub Pages with linting, packaging, and index generation in a single workflow step.
---

# Release Helm Charts - GitHub Action

[View Source Code on GitHub](https://github.com/rayen-dhmaied/release-helm-charts) →

## Overview

### What it is
Reusable GitHub Action that automates Helm chart releases to GitHub Pages.

### Why it exists
Wanted to learn how GitHub Actions composite actions work and understand Helm repository mechanics by building one from scratch. Ended up using it in every project that needs chart distribution.

### Outcome

:::tip Key Results
- **Published on GitHub Marketplace** - Available as reusable action
- **Actually used in production** - Powers chart releases across multiple projects
- **Clean codebase** - Composite action with bash scripts, no external dependencies
:::

---

## Tech Stack

**GitHub Actions** (composite), **Helm**, **GitHub Pages**, **Bash**, **Git**

---

## Implementation Setup

### Action Structure
Composite action using bash scripts for each step:
- Git operations for branch management and change detection
- Helm commands for dependency updates, linting, and packaging
- Index generation and updates using `helm repo index`

### Workflow
1. Checkout source branch and GitHub Pages branch separately
2. Compare branches with git diff to find modified charts
3. Update chart dependencies
4. Lint and package changed charts
5. Update or create `index.yaml`
6. Commit and push to GitHub Pages branch

### Key Implementation Details
- **Dual checkout strategy:** Source branch in workspace root, Pages branch in subdirectory
- **Change detection:** Git diff between branches to process only modified charts
- **Index merging:** Preserves existing chart versions when adding new releases

---

## Key Challenges & Solutions

### Challenge 1: Managing Two Branches Simultaneously

**Problem:** Needed to compare changes between source branch and GitHub Pages branch, then update the Pages branch. Standard checkout action overwrites the workspace.

**Solution:** Used `actions/checkout` twice with different `path` parameters. Source branch at workspace root, Pages branch in subdirectory. Git diff compares between them to find modified charts.

:::success Result
Can detect changes and update publish branch without branch switching or stashing
:::

---

### Challenge 2: Preserving Chart Version History

**Problem:** Helm repository index needs all previous chart versions listed. Regenerating from scratch would lose old releases.

**Solution:** Copy existing `index.yaml` from Pages branch before generating new index. Use `helm repo index --merge` to combine existing entries with new packages.

:::success Result
Published charts maintain full version history, users can install any previous version
:::