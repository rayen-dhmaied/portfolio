---
title: Box2Home - Internal Data Platform
sidebar_position: 4
tags: [NestJS, React, Material UI, PostgreSQL, AWS, ECS, Docker, TypeScript]
description: Internal debugging platform that replaced a paid SaaS tool during my internship. 100+ production tables behind role-based read-only access, with a full audit trail.
---

[View Frontend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-frontend) →  
[View Backend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-backend) →

## Overview

### What it is
An internal web app for Box2Home developers to inspect business data, browse audit logs, and debug production issues without direct write access to the production database.

I built it during my bachelor-degree internship as a software developer. The backend uses NestJS and PostgreSQL, the frontend uses React and Material UI, and the app runs on AWS ECS with Docker containers.

### Why it exists
Box2Home used a third-party SaaS tool for internal data browsing and debugging. The tool cost money every month, did not match the team's workflow, and gave the company little control over feature changes.

My internship project replaced the daily-use parts of that tool with an internal platform the team owned: authentication, role-based access, data exploration, audit logs, and admin screens.

### Outcome

:::tip Key Results
- Replaced the paid third-party tool for the team's daily debugging workflow
- 100+ production tables exposed through a role-based, read-only interface
- Each query and data operation logged with user and timestamp
- NestJS and React services on AWS ECS with Docker
:::

---

## Implementation Highlights

- Modular NestJS backend with auth, users, data access, and audit modules. JWT login with role guards on each protected endpoint.
- Three database connections with different jobs: the platform's own PostgreSQL state, a read-only connection to production data, and a separate database for audit records.
- The audit module logs each query and data operation with the user, timestamp, target entity, and filters, searchable from the UI.
- React and Material UI screens follow the debugging workflow: data explorer, query builder with filters, paginated results with export, admin screens, and the audit viewer.
- Both services ship as multi-stage Docker builds on AWS ECS Fargate behind a load balancer, with logs in CloudWatch.

---

## Key Challenges & Solutions

### Challenge 1: Choosing the Right Internship Scope

**Problem:** The SaaS tool had more features than I could rebuild during an internship. If I copied the wrong screens, the team would keep paying for the old tool.

**Solution:** I reviewed the workflow with the developers who used the tool and focused on the screens they opened during daily debugging: login, data browsing, query filters, audit logs, and user management. I left low-use features out of the first version.

:::success Result
The team moved the core workflow to the internal platform and cancelled the third-party subscription.
:::

---

### Challenge 2: Safe Production Data Access

**Problem:** Developers needed production data for debugging, but the platform could not expose a write path to production from a web UI.

**Solution:** I used a read-only database user for production access. The backend enforced roles on each endpoint, and the audit module logged every query with the user and timestamp. The platform stored audit records outside the production read target.

:::success Result
Developers could inspect production data without direct write access, and each read had an audit trail.
:::

