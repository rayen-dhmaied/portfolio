---
title: Box2Home - Internal Data Platform
tags: [NestJS, React, Material UI, PostgreSQL, AWS, ECS, Docker, TypeScript]
description: Internal data and debugging platform for Box2Home, built in NestJS and React on AWS ECS to replace an expensive third-party tool.
---

[View Frontend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-frontend) →  
[View Backend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-backend) →

## Overview

### What it is
An internal web app for Box2Home's developers. It lets the team query the production database, browse audit logs, and debug data issues without anyone holding direct write access to production.

### Why it exists
The company was paying a third-party SaaS for the same workflow. The bill was high, the tool didn't fit the way the team worked, and any change to that workflow had to wait for the vendor's roadmap. I built this as my end-of-studies internship project to replace it with something the team owns.

### Outcome

:::tip Key Results
- Removed the third-party subscription
- Read-only path to the production database, gated by role
- Audit log of every query and every modification, with the user attached
- UI shaped around the team's workflow
:::

---

## Tech Stack

**Backend:** NestJS (TypeScript), PostgreSQL  
**Frontend:** React, Material UI  
**Deployment:** Docker, AWS ECS  
**Authentication:** JWT

---

## Implementation Setup

### Backend (NestJS)
A modular NestJS backend with one module per concern.

**Auth:**
- JWT authentication
- Role-based access (admin, developer, viewer)
- Token refresh

**User Management:**
- CRUD for accounts
- Role assignment
- Activity tracking

**Data Access Modules:**
One controller / service / repository trio per data entity:
- Services hold the query and transformation logic
- Repositories talk to the database via Prisma
- Controllers expose the REST endpoints the frontend consumes

**Audit & Operation Logs:**
- Every query a user runs is logged
- Every modification is logged with actor and timestamp
- The audit log is searchable from the UI
- Stored in a separate database from the production read-target

**Databases:**
- PostgreSQL for the platform's own state
- Read-only connection to the production database
- A separate logging database for the audit trail

### Frontend (React + Material UI)
A web UI shaped around the team's debugging tasks:

- Data explorer for browsing and querying database tables
- Visual query builder
- Results view with tables, charts, and export
- Admin screens for user and role management
- Audit log viewer with filters and search
- Login flow with JWT handling

**Material UI Components:**
- Data tables with pagination, sort, and filter
- Forms for user management and query building
- Navigation and layout components
- Layouts that hold up on desktop and tablet

### Deployment

**Containers:**
- Multi-stage Dockerfile for the NestJS backend
- Multi-stage Dockerfile for the React production build

**AWS ECS:**
- Backend on ECS Fargate
- Frontend served from ECS behind a load balancer
- Configuration via environment variables
- Logs into CloudWatch

---

## Key Challenges & Solutions

### Challenge 1: Picking What to Build, Given the Internship Window

**Problem:** The vendor tool had years of features built on top of it. Cloning every screen in an internship wouldn't have shipped on time, but skipping the wrong ones would have meant the team kept the subscription anyway.

**Solution:** I sat with the developers who used the vendor tool and worked out which screens they opened every day and which they never touched. The MVP shipped with the high-traffic features (auth, data querying, audit logs) and dropped the long tail.

:::success Result
The team moved over and the subscription was cancelled. The dropped features didn't come back as missing in feedback.
:::

---

### Challenge 2: Safe Production Database Access

**Problem:** The platform exists to give developers access to the production database, which is also the most direct way to corrupt production data. It had to be useful without exposing write paths from a UI screen.

**Solution:** The connection used by the data-access modules is read-only at the database level, not just at the application level. Roles control what each user can see; the audit log captures every query with the user and timestamp attached; authentication is enforced on every request.

:::success Result
No write path into the production database from the platform. Every read is attributable to a user through the audit log.
:::

---

### Challenge 3: Query Performance on Big Tables

**Problem:** Some production tables hold millions of rows. The vendor tool felt fast on them, so a naive replacement that did full-table scans would have shipped slower than what it replaced.

**Solution:** Pagination and explicit `LIMIT/OFFSET` on every list endpoint, indexes on the columns the most-used queries filter by, and virtual scrolling on the frontend so a large result set doesn't render every row at once. Repeated queries hit a short-TTL cache before they reach the database.

:::success Result
Data screens stay responsive on tables with millions of rows. Big result sets don't stall the UI.
:::
