---
title: Professional Experience
sidebar_position: 1
---

### DevOps and Site Reliability Engineer
**CraftSchoolship** · San Jose, Remote · **Oct 2023 - Present**

:::note[Highlights]

- Cut AWS spend **45%** through FinOps analysis, rightsizing, cleanup of idle resources, and replacing Cluster Autoscaler with Karpenter
- Reduced MTTR with an [observability stack](/projects/work-projects/observability) on Prometheus, Loki, Grafana, Jaeger, and Kiali, plus synthetic monitoring, an on-call rotation in Grafana OnCall, and a runbook on every alert. Cut alert volume **60%** by rebuilding thresholds from past incidents, and moved Loki's storage to S3 for cheaper log retention
- Built a [self-service GitOps deployment platform](/projects/work-projects/deploy-center) on ArgoCD, Helm, and GitHub Actions that deploys **20+** customer apps in 3 minutes instead of 15, with automatic rollback
- Led development of a [live quiz platform](/projects/work-projects/quizship) on Kubernetes and built its Go and Python backends for live games, accounts, payments, and analytics. [Load-tested it with k6](/blog/load-testing-quizship-with-k6) to **30,000** concurrent players and halved its AWS cost at that scale by compressing game state
- Wrote [modular Terraform](/blog/refactoring-terraform-into-modules) and CloudFormation that stand up EKS clusters in 3 AWS regions in under 15 minutes, and migrated workloads between AWS accounts without downtime

<details>
<summary>Show more</summary>

- Maintained multi-tenant Kubernetes clusters with Istio mTLS and automated backups of cluster objects and EBS/EFS volumes. Fixed recurring ArgoCD reconciliation and pod-eviction failures, and right-sized HA PostgreSQL (Patroni) to use 35% fewer resources.
- Built CI/CD pipelines for web, mobile, and serverless apps that test, build, and deploy in under 5 minutes, with pull request previews, production approval gates, and [GDPR data-residency checks](/projects/work-projects/hr-system-hub). Automated routine ops work with Python and Bash.
- Moved from nginx-ingress to an API gateway and tuned load balancing, DNS, CDN, and caching to lower request latency.
- Put internal tools behind Keycloak SSO with role-based access, set up a secrets vault, and managed AWS IAM, company workspace accounts, and certificates.
- Designed and built an auto-scaling, multi-AZ [BigBlueButton platform](/projects/work-projects/scalable-bbb-aws) on AWS, with a custom AMI that cut server launch from 11 minutes to 3 and scale-in protection for live meetings.

</details>

:::

---

### Software Developer Intern
**Box2Home** · Sousse, Hybrid · **Feb 2023 - June 2023**

:::note[Highlights]

- Built an [internal data platform](/projects/side-projects/internal-data-platform) (NestJS, React, Prisma) that let developers query **100+** production tables without direct database access, replacing a paid third-party tool
- Added role-based access and an audit trail that logs every query with its user and timestamp
- Containerized and deployed with Docker on AWS ECS, with logs in CloudWatch

:::

---

### IT Operations Intern
**DRÄXLMAIER Group** · Sousse, On-site · **Sept 2022 - Oct 2022**

:::note[Highlights]

- Built a Python CLI that pulls data from HP network switches and exports Excel reports for network troubleshooting
- Set up IT equipment across sites and installed network cabling
- Participated in IT warehouse interventions (Ersatz)

:::
