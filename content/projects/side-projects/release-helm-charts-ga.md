---
title: Release Helm Charts - GitHub Action
sidebar_position: 2
tags: [GitHub Actions, Helm, CI/CD, Bash]
description: GitHub Action on the GitHub Marketplace that publishes Helm charts to GitHub Pages. One step finds changed charts, lints and packages them, and updates the chart repository index without dropping older versions.
---

[View Source Code on GitHub](https://github.com/rayen-dhmaied/release-helm-charts) →

## Overview

### What it is
A GitHub Action that publishes Helm charts from a GitHub repository to GitHub Pages, so people can install them with Helm. A GitHub Action is a reusable step that runs inside GitHub's built-in automation. This one is for teams that keep Helm charts in GitHub and want the same release step in each repository. I built it and published it on the GitHub Marketplace, GitHub's public catalog of actions.

Helm is the package manager for Kubernetes, and a Helm chart is a package of the Kubernetes configuration needed to install an application. A Helm chart repository is a set of packaged charts plus an `index.yaml` file that lists every available chart version. GitHub Pages serves the files on one branch of a repository as a website, so it can host a chart repository.

### Why it exists
I built it to learn how composite GitHub Actions and Helm chart repositories work in detail. I also wanted one release step I could reuse across my own projects instead of copying the same Bash workflow into each repo.

### Outcome

:::tip[Key Results]
- Published on the GitHub Marketplace
- One reusable step finds changed charts, lints and packages them, and publishes them to GitHub Pages
- Older chart versions stay installable after each release
- A run with no changed charts makes no commit, so the Pages branch history shows only real releases
:::

---

## Implementation Highlights

The action is a composite action, a sequence of workflow steps that runs inside the job of the workflow that calls it. It checks out the source branch and the Pages branch, diffs the two trees to find changed charts, and runs `helm dependency update`, `helm lint`, and `helm package` on each one. It then merges the new packages into `index.yaml` and pushes to the Pages branch.

Inputs set the chart path, source branch, Pages branch, and commit metadata. The repo includes the action metadata the Marketplace listing needs, so other workflows can reuse the action.

---

## Key Challenges & Solutions

### Challenge 1: Preserving Chart Version History

**Problem:** A chart repository's `index.yaml` lists every chart version users can install. If the action rebuilt `index.yaml` from only the latest package, older versions would disappear from the index and Helm could no longer install them from the repository.

**Solution:** The action takes the existing `index.yaml` from the Pages branch and passes it to `helm repo index --merge`. Helm adds the new packages and keeps the existing entries.

:::success[Result]
Older chart versions stay installable after new releases.
:::
