---
title: Professional Experience
sidebar_position: 1
---

### DevOps and Site Reliability Engineer
**CraftSchoolship** · San Jose, Remote · **Oct 2023 - Present**

:::note[Highlights]

- Cut AWS spend **45%** through FinOps analysis, rightsizing, cleanup of unused resources, and moving autoscaling from Cluster Autoscaler to Karpenter
- Halved incident resolution time (MTTR) with an [observability stack](/projects/work-projects/observability) on Prometheus, Loki, and Grafana, a runbook on every alert, and an on-call rotation
- Built [DeployCenter](/projects/work-projects/deploy-center), a GitOps platform that deploys **20+** customer apps and cut per-app deploys from 15 mins to 3
- Led development of [QuizShip](/projects/work-projects/quizship), a live quiz platform [load-tested with k6](/blog/load-testing-quizship-with-k6) to **30,000** concurrent players
- Automated **70%** of toil with Python, Bash, and GitHub Actions

<details>
<summary>Show more</summary>

- Wrote [modular Terraform](/blog/refactoring-terraform-into-modules) and CloudFormation that stand up EKS clusters (IAM, networking, storage, add-ons) in 3 AWS regions in under 15 minutes, and migrated workloads between AWS accounts without downtime.
- Upgraded and ran multi-tenant Kubernetes clusters, and fixed recurring ArgoCD reconciliation and pod-eviction failures.
- Built CI/CD pipelines for web and mobile apps that lint, test, build, and deploy in under 5 minutes.
- Tuned high-availability PostgreSQL (Patroni) clusters to use 35% fewer resources, and automated backup and restore of Kubernetes objects and EBS/EFS volumes.
- Replaced nginx-ingress with an API gateway and tuned load balancing, DNS, CDN, and caching, cutting request latency about 40%.
- Moved internal tools behind Keycloak single sign-on with role-based access, which cut employee onboarding time 70%.
- Built both QuizShip backend services, a Go game server for live games and a Python API for accounts, Stripe billing, LMS integration (LTI 1.3), and AI quiz generation.
- Wrote most of [HR System Hub](/projects/work-projects/hr-system-hub), a serverless HR platform on Firebase for a manufacturing client, in a team of three, including its 1,400+ tests.
- Built an auto-scaling, multi-AZ [BigBlueButton video platform](/projects/work-projects/scalable-bbb-aws) on AWS, with a custom machine image (AMI) that cut server launch from 11 minutes to 3 and scale-in protection for live meetings.

</details>

:::

---

### Software Developer Intern
**Box2Home** · Sousse, Hybrid · **Feb 2023 - June 2023**

:::note[Highlights]

- Built an [internal data platform](/projects/side-projects/internal-data-platform) (NestJS, React, Prisma) that let developers query **100+** production tables without direct database access, replacing a paid third-party tool
- Added role-based access and an audit trail that logs every query with its user and timestamp
- Deployed both services with Docker on AWS ECS, with logs in CloudWatch

:::

---

### IT Operations Intern
**DRÄXLMAIER Group** · Sousse, On-site · **Sept 2022 - Oct 2022**

:::note[Highlights]

- Built a Python CLI that pulls data from HP network switches and exports Excel reports for network troubleshooting
- Set up IT equipment across sites and installed network cabling

:::
