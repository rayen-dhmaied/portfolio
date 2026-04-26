---
title: Box2Home - Internal Data Platform
tags: [NestJS, React, Material UI, PostgreSQL, AWS, ECS, Docker, TypeScript]
description: Internal data and debugging platform built during my bachelor internship as a software developer, using NestJS, React, PostgreSQL, Docker, and AWS ECS.
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
- Replaced the third-party subscription for the core workflow
- Read-only production database access controlled by roles
- Audit trail for queries and data operations, tied to the user
- React UI shaped around the team's debugging tasks
- Dockerized NestJS and React services deployed on AWS ECS
:::

---

## Tech Stack

**Backend:** NestJS, TypeScript, Prisma, PostgreSQL  
**Frontend:** React, Material UI  
**Deployment:** Docker, AWS ECS, CloudWatch Logs  
**Authentication:** JWT, role-based access control

---

## Implementation Setup

### Backend
I built a modular NestJS backend with separate modules for auth, users, data access, and audit logs.

**Auth:**
- JWT login and refresh
- Role-based access for admin, developer, and viewer roles
- Guards on protected endpoints

**User Management:**
- Account CRUD
- Role assignment
- Activity tracking

**Data Access:**
- Controller, service, and repository layers per data area
- Prisma for database access
- Read-only connection to the production database
- Input validation before query execution
- Pagination on list endpoints

**Audit and Operation Logs:**
- Logs each query with user, timestamp, target entity, and filters
- Logs data operations performed through the platform
- Stores audit records in a separate database from the production read target
- Exposes a searchable audit log in the UI

**Databases:**
- PostgreSQL for the platform's own state
- Read-only PostgreSQL connection to production data
- Separate logging database for audit records

### Frontend
I built a React and Material UI frontend around the workflows developers used during debugging.

- Data explorer for browsing tables and records
- Query builder with filters
- Results view with pagination, sorting, and export
- Admin screens for users and roles
- Audit log viewer with filters and search
- JWT login flow and session handling

### Deployment

**Containers:**
- Multi-stage Dockerfile for the NestJS backend
- Multi-stage Dockerfile for the React production build
- Runtime config passed through environment variables

**AWS ECS:**
- Backend deployed on ECS Fargate
- Frontend deployed as a containerized web app
- Load balancer in front of the services
- CloudWatch Logs for application output

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

---

### Challenge 3: Query Performance on Large Tables

**Problem:** Some production tables held millions of rows. A naive table browser would run slow queries and render too much data in the browser.

**Solution:** I added pagination and explicit limits on list endpoints, indexed the columns used by the common filters, and used paginated tables in the React UI. Repeated queries could use a short-lived cache before hitting the database again.

:::success Result
Data screens stayed usable on large tables, and the UI did not freeze on big result sets.
:::
