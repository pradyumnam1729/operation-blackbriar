# DevOps Engineer

## Mission

The DevOps Engineer owns the infrastructure, CI/CD pipeline, deployment automation, and observability systems that allow AI-generated code to move safely and quickly from a developer's IDE to production. In an AI-native engineering organization, the DevOps Engineer is the last line of defense: the CI/CD pipeline is the enforcement layer that ensures AI-generated code meets every quality, security, and compliance standard before reaching a production environment.

The DevOps Engineer does not review code. The DevOps Engineer builds the automated systems that review code on behalf of the entire team — and ensures that no code reaches production that hasn't passed through every gate.

---

## Responsibilities

### CI/CD Pipeline Architecture and Ownership

Design, implement, and maintain the multi-stage CI/CD pipeline. Every stage must be automated, reproducible, and auditable.

**Stage 1: PR Validation (runs on every PR)**
- .NET build (fail fast on compilation errors)
- TypeScript compilation (tsc --noEmit, zero errors required)
- Unit tests (target: < 3 minutes total)
- Architecture tests (NetArchTest, zero violations)
- Linting (backend: Roslyn analyzers; frontend: ESLint, zero warnings)
- Secrets scanning (no hardcoded credentials, API keys, or connection strings in code)
- Dependency vulnerability scan (OWASP Dependency-Check)

**Stage 2: Merge to Main**
- All Stage 1 checks
- Integration tests with Testcontainers PostgreSQL (target: < 15 minutes)
- EF Core migration smoke test (migrations apply successfully on a fresh database)
- Frontend bundle size check (no single bundle increase > 15% without explicit approval)
- SAST (Static Application Security Testing) scan

**Stage 3: Deploy to Staging**
- All Stage 1 and 2 checks (must have passed on the same commit)
- Docker image build and push to ECR
- Terraform plan (infrastructure changes visible to reviewer before apply)
- ECS rolling deployment to staging environment
- Smoke tests against staging (health endpoint, basic API calls)
- E2E test suite execution (Playwright against staging)

**Stage 4: Deploy to Production**
- Manual approval gate (Engineering Director only — Gate 4 per `vol-7-ai-engineering/14-human-approval-gates.md`; QA Lead confirms staging smoke tests passed before checklist is submitted)
- Blue/green deployment via AWS CodeDeploy
- Database migration applied (EF Core, pre-deployment)
- Synthetic monitoring run (post-deployment validation)
- Automatic rollback if health check fails within 5 minutes of deployment

### Infrastructure as Code

Own all infrastructure definitions in Terraform. No AWS resources are created manually in the console — everything is code, reviewed, version-controlled, and deployed via CI.

Resources under IaC management: VPC + subnets, ECS cluster + task definitions, RDS PostgreSQL (with PostGIS extension), ElastiCache Redis, SQS queues (report generation, notification), S3 buckets (reports, media), CloudFront (frontend CDN), Route 53 (DNS), ACM certificates, IAM roles and policies, CloudWatch dashboards and alarms.

AI-assisted Terraform: use Claude to generate Terraform resource blocks from descriptions ("create an S3 bucket with versioning enabled, lifecycle rule to delete objects after 7 days, KMS encryption, and block all public access"). Review AI-generated Terraform for: correct resource naming conventions, missing security configurations (encryption, access logging), cost implications (instance sizes, multi-AZ settings).

### Observability

Own the observability stack: structured logging, metrics, distributed tracing, alerting.

**Logging**: All services emit structured JSON logs to CloudWatch. Log format includes: tenantId, correlationId, requestId, userId, level, message, duration. No PII in logs. Log retention: 90 days in CloudWatch, 1 year archived in S3.

**Metrics**: CloudWatch custom metrics for: API endpoint latency (P50, P95, P99), database connection pool usage, EF Core query count per request (N+1 detection proxy), SQS queue depth (report job backlog), ECS task CPU/memory.

**Tracing**: AWS X-Ray for distributed tracing across API, ECS tasks, and database. Traces are sampled at 10% under normal load, 100% when an error is detected.

**Alerting**: PagerDuty integration for P1 alerts (production down, database unavailable, error rate > 5% for 5 minutes). Email for P2 alerts (staging failures, queue backlog growing). Slack for informational alerts (deployment completed, large reports queued).

**AI-Assisted Log Analysis**: When a production incident occurs, the DevOps Engineer exports the relevant CloudWatch logs and uses Claude to analyze them: "Identify the root cause of the elevated error rate between 14:32 and 14:47 UTC. Logs attached." This reduces incident diagnosis time from 2 hours to 15 minutes for pattern-matching investigations.

### Security Enforcement at Deployment

The DevOps Engineer is the enforcer of security standards at the deployment layer:

- Container images are scanned for vulnerabilities (Trivy) before deployment
- ECS tasks run with minimum-privilege IAM roles (no wildcard permissions)
- No secrets in environment variables (all secrets via AWS Secrets Manager)
- VPC configuration reviewed quarterly: are public subnets exposing resources that should be private?
- RDS is not publicly accessible; only accessible from ECS task security groups
- S3 buckets have explicit public access blocks; signed URLs are the only external access mechanism
- WAF rules are applied to the ALB protecting the API

When AI agents generate Terraform that creates a public S3 bucket, allows unrestricted inbound on security groups, or places RDS in a public subnet, the SAST scan catches it and blocks the PR. The DevOps Engineer reviews every SAST finding and categorizes: block (security violation), warn (suboptimal but not a security issue), or accept with rationale.

### Incident Response

Own incident response processes: on-call rotation, incident declaration criteria, runbook library, and postmortem facilitation.

**Runbooks**: For every P1 scenario, there is a runbook: step-by-step recovery instructions that any on-call engineer can follow. Use AI to generate runbook first drafts from incident postmortems: "Given this postmortem, generate a runbook for handling future occurrences of this incident pattern." The DevOps Engineer reviews and validates each runbook against the actual system.

**On-call rotation**: The DevOps Engineer is primary on-call. The Backend Lead is secondary. The ED is the escalation contact.

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| CI Build Time (PR gate) | < 10 minutes | Per build |
| CI Build Time (Merge gate) | < 20 minutes | Per build |
| Deployment Frequency | At least weekly to staging; bi-weekly to production | Weekly |
| Deployment Success Rate | > 99% (rollbacks < 1% of deployments) | Monthly |
| MTTR (P1 Incidents) | < 2 hours | Per incident |
| Security Findings (Critical) | Zero unresolved critical findings in production | Weekly |
| Infrastructure Drift | Zero manual console changes; 100% IaC | Monthly audit |
| Pipeline Coverage | 100% of repositories covered by CI/CD | Monthly audit |
| Log Retention Compliance | 100% (no gaps in audit log coverage) | Monthly |

---

## Authority

The DevOps Engineer has authority to:
- Block a deployment if any quality gate fails, regardless of business pressure
- Require a security fix before deploying a release
- Roll back a production deployment if health metrics indicate a problem
- Reject Terraform changes that would create security vulnerabilities

The DevOps Engineer does not have authority to:
- Approve product scope changes
- Override QA Lead on test pass/fail determinations
- Access customer data in production (read-only access to logs is acceptable; data access requires additional approval)

---

## Deliverables

**Per deployment**: Deployment record (what was deployed, when, by whom, test results, health status)

**Weekly**: Infrastructure health report (cost, performance, security scan summary)

**Monthly**: Security posture report, pipeline performance metrics, incident summary

**Quarterly**: Infrastructure cost optimization review, disaster recovery drill results

---

## Decision Making

When evaluating infrastructure changes:
1. **Security first**: Does this change increase the attack surface? Any new public endpoints, relaxed IAM policies, or unencrypted data stores require explicit justification.
2. **Cost impact**: What is the monthly cost delta? Changes above $500/month require ED approval.
3. **Availability impact**: Does this change affect the availability of any tenant's data or service?
4. **Rollback plan**: If this goes wrong, how do we roll it back? Changes without a clear rollback path require additional review.

---

## Daily Workflow

**08:00–08:30** — Review overnight CI results, deployment history, and production health dashboard. Any incidents from overnight? Any pipeline failures that blocked morning work?

**08:30–09:30** — Pipeline maintenance: fix any broken CI configurations, investigate flaky pipeline steps.

**09:30–11:30** — Infrastructure work: Terraform changes, new resource provisioning, security group reviews, cost optimization.

**11:30–12:00** — Security review: review SAST findings from overnight scans, vulnerability scan results, dependency updates.

**14:00–16:00** — Observability work: tuning CloudWatch dashboards, writing new alarms, analyzing log patterns, runbook updates.

**16:00–17:00** — Documentation: updating runbooks, IaC documentation, deployment procedures.

---

## Collaboration

**With Backend Lead**: Close partnership on database performance (query performance from RDS perspective), connection pool sizing, and ECS task memory configuration for compute-intensive operations (report generation, optimization).

**With AI Engineer**: Partnership on scaling the AI service infrastructure: model inference endpoints, queue sizing for async AI jobs, CloudWatch metrics for AI service latency.

**With Tech Architect**: Review all infrastructure-related ADRs before publication. Infrastructure choices (Redis vs. in-memory caching, SQS vs. direct invocation) are joint decisions.

**With QA Lead**: Integration test infrastructure (Testcontainers requires Docker in CI), E2E test execution environment, and staging environment stability.

---

## Escalation

The DevOps Engineer escalates to the ED when:
- A security finding requires a production hotfix
- Infrastructure costs are projected to exceed budget by > 20%
- A deployment fails to roll back automatically and requires manual intervention
- An on-call incident exceeds 4 hours without resolution

---

## Continuous Improvement

Monthly: review CI pipeline duration. Any stages that are getting slower? Optimize build caching, parallelize test execution, or split large test suites.

Quarterly: infrastructure cost review. Which resources are underutilized? Which are over-provisioned? Use AWS Cost Explorer data to identify optimization opportunities.

Quarterly: disaster recovery drill. Simulate the loss of the primary RDS instance. Verify that the read replica promotion and DNS failover work as designed. Document the actual RTO and RPO achieved.

---

## Example Scenarios

### Scenario 1: Blocking a Terraform PR that Creates a Public S3 Bucket

An AI-generated Terraform PR creates a new S3 bucket for storing inspection photos. The configuration is mostly correct, but the `block_public_access` setting is not configured, and there is an `acl = "public-read"` line that the AI added without understanding the security implications.

The SAST scan flags it as a critical security finding. The DevOps Engineer investigates: this bucket stores inspection photos which may include personally identifiable location data. A public bucket is unacceptable.

The DevOps Engineer blocks the PR with a specific correction: (1) remove the `acl` line, (2) add `block_public_acls = true`, `ignore_public_acls = true`, `block_public_policy = true`, `restrict_public_buckets = true`, (3) add server-side encryption with aws:kms, (4) add access logging to the audit log bucket. The corrected Terraform is reviewed and merged.

### Scenario 2: AI-Assisted Incident Diagnosis

At 14:35, CloudWatch alerts fire: API error rate is 8%, threshold is 5%. PagerDuty pages the DevOps Engineer. Initial investigation shows errors are concentrated on the `/api/v1/assets/list` endpoint.

The DevOps Engineer exports the CloudWatch logs for the last 30 minutes and uses Claude: "Analyze these production logs. There is an elevated error rate on the asset list endpoint starting at 14:32 UTC. Identify the most likely root cause."

Claude identifies: a specific SQL query is timing out consistently. The timeout started at 14:32 — which corresponds to a deployment at 14:28. The logs show the query is attempting to load all assets without a tenant filter (a multi-tenancy violation that slipped through review).

The DevOps Engineer triggers a rollback at 14:47 (12 minutes into the incident). The MTTR is 15 minutes. The postmortem note: the PR that introduced the bug should have been caught by the architecture tests — investigation reveals the test was disabled during refactoring and not re-enabled.

### Scenario 3: Optimizing CI Pipeline Duration

The CI pipeline has grown from 8 minutes (initial) to 22 minutes as test coverage has expanded. Engineers are waiting 22 minutes for PR validation feedback, which is disrupting the development flow.

The DevOps Engineer analyzes the pipeline timing: unit tests (2 min), integration tests (16 min), TypeScript compilation (2 min), linting (2 min). The integration tests are the bottleneck.

Investigation: Testcontainers starts a fresh PostgreSQL container for every test file (32 test files = 32 container starts). The fix: shared container lifecycle — start one container at the beginning of the test run, run all tests against it with transaction rollback for isolation.

After the optimization, integration tests run in 4 minutes instead of 16. Total pipeline duration: 10 minutes. The DevOps Engineer documents the pattern and adds it to the CI optimization runbook.

---

## AI Agent Pairing

The DevOps Engineer pairs with an **Infrastructure Automation Agent** — a Claude Code session used for IaC generation, pipeline debugging, and observability configuration.

**What the agent handles autonomously:**
- Generating Terraform resource blocks for new AWS infrastructure (ECS task definitions, RDS configurations, SQS queues, IAM policies, CloudWatch alarms)
- Drafting GitHub Actions workflow YAML for new pipeline stages
- Debugging CI failures by reading workflow logs and identifying root causes
- Generating Docker multi-stage build files optimised for .NET + React
- Producing OTel Collector configuration for new export targets
- Auditing Terraform plans for security misconfigurations (open security groups, unencrypted buckets, overly permissive IAM roles)

**What requires the human's judgment:**
- Approving Terraform `plan` output before `apply` — the agent identifies what will change, the human confirms it is safe
- Cost decisions: choosing instance sizes, multi-AZ vs. single-AZ, reserved vs. on-demand capacity
- Security posture decisions: which IAM actions to allow, which ports to expose, whether a security group rule is acceptable
- Triggering production deployments (Gate 4 — Engineering Director only; see `vol-7-ai-engineering/14-human-approval-gates.md`)

**Prompt guidance:** Brief the agent with the AWS account context (region, naming conventions, existing resource names), the specific infrastructure change needed, and any cost or compliance constraints. Attach the current Terraform state summary if the change modifies existing resources. See `engineering-playbook/vol-3-architecture/14-cicd.md` for pipeline architecture context.
