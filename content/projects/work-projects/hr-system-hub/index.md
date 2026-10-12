---
title: HR System Hub - Serverless HR Platform for Manufacturing
sidebar_position: 5
tags: [TypeScript, React, Firebase, Cloud Functions, Firestore, Firebase Auth, Cloud Storage, Cloud Scheduler, Express, TanStack Query, Tailwind, PDFKit, Vitest, GitHub Actions, Claude Code, i18n]
description: HR platform that replaced a manufacturing client's paper employee evaluations. Lead contributor on a three-engineer contract team. Serverless on Firebase in EU regions, about 120 API endpoints, and 1,400+ tests.
---

import Architecture from './images/architecture.svg';

## Overview

### What it is
HR System Hub is an HR platform that a team of three engineers built under contract for a single-plant manufacturer. The project was part of an Industry 4.0 (factory digitalization) program run by UNIDO, the United Nations Industrial Development Organization. It replaces the client's paper evaluation form and the Excel files around it. Employees write a self-assessment, their manager reviews it, HR validates it, and after e-signatures the platform archives the evaluation as a PDF report.

I was the lead contributor, with about 380 of the team's 645 commits. My parts were the evaluation workflow, the UI rework, the French, English, and Arabic translations, the PDF report engine, the 1,400-case test suite, and the CI/CD pipelines. I used Claude Code, an AI coding assistant, for test generation, refactoring, and review passes, and every change still went through pull request review.

### Why it exists
The client ran HR on paper and spreadsheets. Each evaluation cycle meant printing a form per employee, scoring it by hand, collecting signatures on paper, and filing it in a cabinet. Forms got lost and cycles were slow. HR also could not answer questions such as what share of the workforce had a closed evaluation that year.

We delivered it as a managed service on serverless Firebase, so the client has no servers to maintain and the cost follows usage. Employee evaluations are personal data and the program is European, so we built the platform to comply with the GDPR, the EU data protection law. Every resource runs in an EU region, and the CI pipeline fails any deploy that would place a function elsewhere.

The contract covered only the evaluation module, one of four in the spec. The other three (training plans, leave requests, and attendance tracking) are built as optional modules behind configuration flags, so each deployment turns on only the modules the client paid for.

### Outcome

:::tip[Key Results]
- Replaced the client's paper evaluation cycle, from self-assessment to an archived PDF report for each approved evaluation
- About 120 REST API endpoints on serverless Firebase, all in EU regions
- The server enforces the scoring rules set by the client's parent group, so HR no longer checks them by hand
- French, English, and Arabic interface, with right-to-left layout for Arabic
- 1,400+ test cases in 51 test files run on every pull request
:::

---

## Architecture

<figure className="diagram">
  <Architecture />
</figure>

:::info[Architecture Overview]
The React single-page app signs users in with Firebase Auth and sends their ID token with every request. Firebase Hosting rewrites `/api/**` to an Express API on Cloud Functions (2nd gen), where middleware verifies the token, reads the user's role from a custom claim, and loads their profile before any handler runs. Firestore and Storage security rules block direct client access, so every change goes through the audited API. File downloads use signed URLs that expire after 15 minutes, and Cloud Scheduler triggers a stale-evaluation sweep every 24 hours.
:::

---

## Implementation Highlights

- The daily sweep finds evaluations that have waited at one step past a configurable threshold and reminds whoever has to act next (the employee, the evaluator, or HR), with a cooldown against repeat reminders.
- Managers can only access the records of employees in their own reporting line, and an immutable audit log records each privileged action with the old and new values, the actor, and the client IP.
- In the CI/CD pipelines I built, every pull request gets a preview site, merges to main deploy to staging, and production deploys need manual approval through a GitHub Environment. Operational jobs such as demo seeding and data backfills require a typed confirmation token.

---

## Key Challenges & Solutions

### Challenge 1: Relational HR Workflows on a Document Store

**Problem:** Evaluations reference employees, evaluators, and a competency catalog. Managers list their review queue, and HR queries statistics across an evaluation campaign. Firestore has no joins, so a normalized model would cost one extra read per row in every list view (the N+1 query problem). Pointing evaluations at the live employee record would also change past evaluations whenever someone moved teams.

**Solution:** I designed the data model around how each screen reads data. Each evaluation embeds a snapshot of the employee's profile from when it was created, so the history view reads one document and shows the profile as it was then. Composite indexes serve the two most frequent queries, an employee's history by creation date and a manager's queue by status.

:::success[Result]
List views read a fixed number of documents regardless of org size, and past evaluations stay accurate after a reorganization.
:::

---

### Challenge 2: Turning a Paper Form into Rules a Server Enforces

**Problem:** The paper form could not stop errors. Objective weights did not always sum to 100%, scores went past the cap, and evaluations were signed before the employee saw them or edited after signing.

**Solution:** I wrote the form's rules as checks in the API. Each evaluation is a state machine with a fixed order of steps, and the server rejects any step taken out of order. The scoring module caps objective results at 150 and rejects weights that do not total 100%. Creation and update both enforce the objective count (3 to 6, with a minimum of one for production staff). Signatures are write-once and approved evaluations are read-only. An admin unlock, which writes an audit entry, is the only way to reopen one. Each rule carries its requirement ID from the spec (EVAL-001 to EVAL-012), so the commits for each rule trace back to the clause that required it.

:::success[Result]
HR only sees evaluations that already pass the form's rules. The client audits the delivery against the spec by searching the git history for requirement IDs.
:::

---

### Challenge 3: Matching the Parent Group's Form in PDFKit

**Problem:** HR files the generated PDF in place of the paper form, so it had to match the layout set by the parent group's headquarters. PDFKit, a Node.js PDF library, has no table layout. Long French labels wrapped across row borders, the draft watermark covered content, and signature blocks split across page breaks.

**Solution:** I wrote the layout engine to measure content before drawing it. Each table row measures its wrapped text and sets its height first, so borders fit the content. The BROUILLON ("draft" in French) watermark is a rotated page background scaled to fit A4. A signature block that would split moves to the next page as one unit.

:::success[Result]
Approved evaluations are archived as versioned PDFs in Cloud Storage. Draft previews carry the watermark, so nobody mistakes one for a signed report.
:::
