---
title: Box2Home - Internal Data Platform
tags: [NestJS, React, Material UI, PostgreSQL, AWS, ECS, Docker, TypeScript]
description: Internal data platform for Box2Home delivery company enabling developers to access and debug database data, replacing expensive third-party solution with custom NestJS/React application deployed on AWS ECS.
---

# Box2Home - Internal Data Platform

[View Frontend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-frontend) →  
[View Backend Source Code on GitHub](https://github.com/rayen-dhmaied/box2home-backend) →

## Overview

### What it is
Internal platform for Box2Home delivery company providing developers with database access and debugging tools. Web-based interface for querying production data, viewing logs, and troubleshooting issues.

### Why it exists
Company relied on expensive third-party solution for database access and debugging. Needed cost-effective alternative with better performance and features tailored to team's workflow. Built as end-of-studies internship project.

### Outcome

:::tip Key Results
- **Replaced third-party tool** - Eliminated costly subscription fees
- **Improved performance** - Faster data queries and visualization
- **Better UX** - Custom interface designed for team's specific needs
- **Audit logging** - Complete tracking of database access and operations
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
Built modular backend following NestJS architecture:

**Authentication & Authorization:**
- JWT-based authentication for developer access
- Role-based access control (admin, developer, viewer)
- Session management and token refresh

**User Management:**
- CRUD operations for user accounts
- Role assignment and permissions
- User activity tracking

**Data Access Modules:**
Created service/repository/controller pattern for each data entity:
- **Services:** Business logic for data queries and transformations
- **Repositories:** Database interaction layer with Prisma ORM
- **Controllers:** REST API endpoints for frontend consumption

**Audit & Operations Logs:**
- Log all database queries performed by users
- Track data modifications and who made them
- Store operation history with timestamps and user context
- Searchable audit trail for compliance

**Database:**
- PostgreSQL as primary data store
- Read-only access to production database for queries
- Separate logging database for audit trail

### Frontend (React + Material UI)
Built responsive web interface:

**Features:**
- **Data explorer:** Browse and query database tables
- **Query builder:** Visual interface for constructing queries
- **Results visualization:** Tables, charts, and export options
- **User management:** Admin interface for managing access
- **Audit logs viewer:** Search and filter operation history
- **Authentication:** Login flow with JWT token handling

**Material UI Components:**
- Data tables with pagination, sorting, filtering
- Forms for user management and query building
- Navigation and layout components
- Responsive design for desktop and tablet

### Deployment

**Containerization:**
- Dockerfile for backend (NestJS)
- Dockerfile for frontend (React production build)
- Multi-stage builds for optimized image sizes

**AWS ECS:**
- Backend service running on ECS Fargate
- Frontend served from ECS with load balancer
- Environment variables for configuration
- CloudWatch logs for monitoring

---

## Key Challenges & Solutions

### Challenge 1: Replacing Third-Party Tool Feature Parity

**Problem:** Existing tool had features the team relied on. Needed to identify essential features and implement them without feature bloat while staying within internship timeframe.

**Solution:** Conducted user interviews with development team to prioritize features. Built MVP with core functionality (authentication, data querying, audit logs). Focused on most-used features rather than complete replication.

:::success Result
Delivered platform with essential features in internship period. Team adopted new tool, eliminating subscription costs
:::

---

### Challenge 2: Ensuring Secure Database Access

**Problem:** Platform provides direct access to production database. Needed to prevent accidental modifications and ensure only authorized developers can access sensitive data.

**Solution:** Implemented read-only database connections for data queries. Added role-based permissions with different access levels. Comprehensive audit logging of all queries. Required authentication for every request.

:::success Result
Zero unauthorized access incidents. Complete audit trail of all database operations for security compliance
:::

---

### Challenge 3: Optimizing Query Performance

**Problem:** Some database tables had millions of rows. Full table scans caused slow response times and poor user experience compared to previous tool.

**Solution:** Implemented pagination on backend with efficient SQL queries. Added database indexes for frequently queried columns. Frontend uses virtual scrolling for large result sets. Query result caching for repeated requests.

:::success Result
Query response times improved significantly. Platform outperformed previous third-party solution in data visualization speed
:::