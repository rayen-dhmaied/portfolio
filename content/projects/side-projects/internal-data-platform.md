---
title: Box2Home - Internal Data Platform
sidebar_position: 4
tags: [NestJS, React, Material UI, PostgreSQL, AWS, ECS, Docker, TypeScript]
description: Internal web app I built during my 2023 internship at Box2Home so developers could debug with production data. It replaced a paid third-party tool, with read-only, role-based access to 100+ production tables and a log of every query.
---

[View Frontend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-frontend) →  
[View Backend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-backend) →

## Overview

### What it is
An internal web app for Box2Home's developers to look up production data while debugging. It lets them browse and filter data from 100+ tables of the production database without writing SQL and without write access to that database. Every query is logged with the user and the time.

I built it during my bachelor's degree internship at Box2Home, where I worked as a software developer intern from February to June 2023. It replaced a paid third-party tool, and the team cancelled that subscription.

The backend is written in TypeScript with NestJS, a Node.js framework for server APIs. It uses Prisma, a TypeScript library for database queries, and stores the platform's own data in PostgreSQL. The frontend uses React and Material UI, a library of ready-made React components. Both run as Docker containers on AWS ECS, Amazon's managed container service.

### Why it exists
Box2Home paid for a third-party web tool that developers used to browse internal data and debug. The tool did not match the team's workflow, and the company had little control over changes to its features.

My internship project was to replace the parts of that tool the developers used every day with a platform the team owned. The first version covered login, role-based access (what each user can see and do depends on their role), data browsing, audit logs, and admin screens.

### Outcome

:::tip[Key Results]
- Replaced the paid third-party tool for daily debugging, and the team cancelled its subscription
- 100+ production database tables available through a read-only, role-based web interface
- Every query and data operation logged with the user and timestamp
- Backend and frontend deployed as Docker containers on AWS ECS, with logs in CloudWatch
:::

---

## Implementation Highlights

- The NestJS backend is split into modules for auth, users, data access, and audit. Users log in and receive a JWT (a signed login token the browser sends with each request), and a role guard on each protected endpoint checks the user's role before the request runs.
- The backend uses three database connections: the platform's own PostgreSQL database, a read-only connection to the production database, and a separate database for audit records.
- The audit module records each query and data operation with the user, timestamp, target entity, and filters. The records are searchable from the audit viewer screen.
- The React screens cover the debugging workflow: a data explorer, a query builder with filters, paginated results with export, admin screens, and the audit viewer.
- Both services build from multi-stage Dockerfiles, which leave the build tools out of the final image. They run on AWS ECS Fargate, where AWS manages the servers, behind a load balancer. Logs go to CloudWatch, AWS's log service.

---

## Key Challenges & Solutions

### Challenge 1: Choosing the Right Internship Scope

**Problem:** The third-party tool had more features than I could rebuild in one internship. If I rebuilt the wrong screens, developers would still need the old tool and the company would keep paying for it.

**Solution:** I went through the debugging workflow with the developers who used the tool and picked the screens they opened every day: login, data browsing, query filters, audit logs, and user management. I built those and left the less-used features out of the first version.

:::success[Result]
The developers moved their daily debugging to the internal platform, and the team cancelled the third-party subscription.
:::

---

### Challenge 2: Safe Production Data Access

**Problem:** Developers needed to read production data to debug issues. The platform had to give them that data with no way to change it from the web UI.

**Solution:** The backend connects to production with a read-only database user, so the database rejects writes even if the backend code has a bug. Role guards check every request against the user's role, and the audit module logs every query with the user and timestamp. Audit records go to a separate database, because the production connection cannot write.

:::success[Result]
Developers could read production data without write access, and every query left a record of who ran it and when.
:::
