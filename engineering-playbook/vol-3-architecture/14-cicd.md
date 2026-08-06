# CI/CD Pipeline

> Volume 3 · Architecture · Document 14  
> GitHub Actions workflows, environment strategy, rollback, and secrets in CI

---

> **Implementation Status (as of 2026-07-19)**
>
> | Phase | Status |
> |---|---|
> | PR Validation (lint, build, unit + integration tests, coverage gate) | ✅ Shipped — see `.github/workflows/ci.yml` |
> | Docker image build + ECR push | ⏳ Pending — target: Beta milestone |
> | Dev environment auto-deploy + E2E smoke tests | ⏳ Pending — target: Beta milestone |
> | Staging environment + release workflow | ⏳ Pending — target: GA milestone |
> | Production deployment with manual Gate 4 approval | ⏳ Pending — target: GA milestone |
>
> The pipeline description below is the full target-state architecture. Currently only the PR Validation stage is live.

---

## Overview

The CI/CD pipeline enforces code quality before code reaches any shared environment. Every piece of code passes through automated checks before a human ever reviews it. The human's job in code review is architectural judgment and domain reasoning — not catching syntax errors or missing test coverage. Automation handles the mechanical checks.

```
Developer pushes branch
  → PR Validation workflow (automated) [✅ LIVE]
    → Lint → Build → Unit Tests → Integration Tests → Frontend Tests → Security Scan
    → Required to pass before PR can be merged

PR merged to main
  → Main Branch workflow [⏳ PENDING]
    → All PR checks
    → Build Docker image
    → Push to ECR
    → Deploy to dev environment
    → E2E smoke tests on dev
    → Notify team

Engineer tags a release (v1.2.0)
  → Release workflow [⏳ PENDING]
    → All main checks
    → Deploy to staging
    → Manual approval gate
    → Deploy to production
    → Update API Gateway Swagger
    → Publish release notes
```

---

## GitHub Actions Workflows

### 1. PR Validation (`pr.yml`)

Triggered on: `pull_request` to `main` or `develop`

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main, develop]

jobs:
  backend:
    name: Backend Validation
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: asset_maintenance_test
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpassword
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Restore dependencies
        run: dotnet restore
        working-directory: backend/Aurigo.AssetMaintenance

      - name: Check formatting
        run: dotnet format --verify-no-changes
        working-directory: backend/Aurigo.AssetMaintenance

      - name: Build
        run: dotnet build --no-restore --configuration Release
        working-directory: backend/Aurigo.AssetMaintenance

      - name: Run unit tests
        run: >
          dotnet test
          --no-build
          --configuration Release
          --filter Category=Unit
          --collect:"XPlat Code Coverage"
          --results-directory ./coverage
        working-directory: backend/Aurigo.AssetMaintenance

      - name: Run integration tests
        run: >
          dotnet test
          --no-build
          --configuration Release
          --filter Category=Integration
        working-directory: backend/Aurigo.AssetMaintenance
        env:
          # Testcontainers manages its own PostgreSQL; no override needed

      - name: Coverage gate
        uses: irongut/CodeCoverageSummary@v1.3.0
        with:
          filename: coverage/**/coverage.cobertura.xml
          badge: true
          thresholds: '80 90'  # warning at 80%, fail at less than 90% for Calculations

      - name: Security scan (NuGet vulnerabilities)
        run: dotnet list package --vulnerable --include-transitive
        working-directory: backend/Aurigo.AssetMaintenance

  frontend:
    name: Frontend Validation
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/asset-maintenance-web/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend/asset-maintenance-web

      - name: Lint
        run: npm run lint
        working-directory: frontend/asset-maintenance-web

      - name: TypeScript check
        run: npm run type-check
        working-directory: frontend/asset-maintenance-web

      - name: Unit and component tests
        run: npm test -- --run --coverage
        working-directory: frontend/asset-maintenance-web

      - name: Build
        run: npm run build
        working-directory: frontend/asset-maintenance-web

  security-scan:
    name: Container Security Scan
    runs-on: ubuntu-latest
    needs: [backend]

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image (for scanning)
        run: docker build -t asset-maintenance:scan .

      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'asset-maintenance:scan'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

All three jobs (`backend`, `frontend`, `security-scan`) are required checks on the branch protection rule. A PR cannot be merged unless all three pass.

---

### 2. Main Branch (`main.yml`)

Triggered on: `push` to `main` (i.e., after PR merge)

```yaml
name: Deploy to Dev

on:
  push:
    branches: [main]

jobs:
  validate:
    uses: ./.github/workflows/pr.yml  # reuse PR validation

  build-and-push:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    needs: validate
    permissions:
      id-token: write  # for OIDC authentication to AWS

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ vars.AWS_ACCOUNT_ID }}:role/GitHubActionsDeployRole
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/asset-maintenance:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/asset-maintenance:$IMAGE_TAG \
                     $ECR_REGISTRY/asset-maintenance:latest
          docker push $ECR_REGISTRY/asset-maintenance:$IMAGE_TAG
          docker push $ECR_REGISTRY/asset-maintenance:latest

  deploy-dev:
    name: Deploy to Dev
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: dev

    steps:
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster aurigo-maintain-dev \
            --service asset-maintenance \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster aurigo-maintain-dev \
            --services asset-maintenance

      - name: Run E2E smoke tests
        run: npm run e2e:smoke -- --config baseURL=${{ vars.DEV_API_URL }}
        working-directory: frontend/asset-maintenance-web
        env:
          TEST_INSPECTOR_PASSWORD: ${{ secrets.DEV_TEST_PASSWORD }}

  notify:
    name: Notify Team
    runs-on: ubuntu-latest
    needs: [deploy-dev]
    if: always()
    steps:
      - name: Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: 'C0XXXXXXXXX'
          payload: |
            {
              "text": "${{ needs.deploy-dev.result == 'success' && '✓' || '✗' }} Deploy to dev: ${{ github.sha }}"
            }
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

### 3. Release (`release.yml`)

Triggered on: `push` of a tag matching `v*.*.*`

```yaml
name: Release to Production

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  deploy-staging:
    name: Deploy to Staging
    environment: staging

    steps:
      - name: Deploy to staging ECS
        # ... same as dev deploy

      - name: Run full E2E suite on staging
        run: npm run e2e -- --config baseURL=${{ vars.STAGING_API_URL }}

      - name: Run performance tests on staging
        run: k6 run tests/performance/baseline.js --env BASE_URL=${{ vars.STAGING_API_URL }}

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    environment: production  # this environment requires manual approval in GitHub
                             # (configured in repo Settings > Environments > production)

    steps:
      - name: Deploy to production ECS
        run: |
          aws ecs update-service \
            --cluster aurigo-maintain-prod \
            --service asset-maintenance \
            --force-new-deployment

      - name: Wait for stable
        run: aws ecs wait services-stable ...

      - name: Tag ECR image as release
        run: |
          docker tag $ECR_REGISTRY/asset-maintenance:${{ github.sha }} \
                     $ECR_REGISTRY/asset-maintenance:${{ github.ref_name }}
          docker push $ECR_REGISTRY/asset-maintenance:${{ github.ref_name }}

      - name: Update Swagger in API Gateway
        run: |
          aws apigateway put-rest-api \
            --rest-api-id ${{ vars.API_GATEWAY_ID }} \
            --body fileb://infra/swagger/asset-maintenance-v1.json

      - name: Generate release notes
        uses: release-drafter/release-drafter@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Environment Strategy

| Environment | Trigger | Audience | Stability | Approval Required |
|---|---|---|---|---|
| **dev** | Every merge to `main` | Engineers | Low — bleeding edge | No |
| **staging** | Every release tag | QA, PM, internal demos | Medium — release candidate | No |
| **production** | Every release tag | Customers | High — tested releases only | Yes — manual in GitHub |

### dev Environment

- Automatically reflects the latest `main` branch.
- Used for: integration testing, QA exploratory testing, developer cross-service testing.
- Database: pre-seeded with realistic synthetic data from `seeds/` directory.
- SLA: best-effort. Outages are expected and tolerated.

### staging Environment

- Full production replica (same instance types, same database size, same integrations pointing to staging EAM endpoints).
- Used for: pre-release validation, performance testing, customer acceptance testing for large enterprise customers.
- Database: snapshot of anonymized production data (refreshed monthly).
- SLA: best-effort during business hours.

### production Environment

- Customer-facing.
- Deploy window: Monday–Thursday, 10am–4pm Eastern. No Friday deploys.
- Database: customer data. Migrations are applied before the new code is deployed (blue/green switch happens after migration succeeds).
- SLA: 99.5% uptime target.

---

## Rollback

Aurigo Maintain uses blue/green deployment on ECS. Two task sets run simultaneously: the current (green) and the new (blue). Traffic shifts to blue after health checks pass. If health checks fail, the deployment stops and traffic remains on green.

**Automatic rollback:** If the ECS deployment does not stabilize within 10 minutes (all tasks healthy and passing health checks), ECS rolls back to the previous task definition automatically.

**Manual rollback:** If an issue is discovered after deployment:
1. Identify the previous stable ECR image tag (from git tags or ECR tag history).
2. Update the ECS task definition to point to the previous image.
3. Trigger a new deployment: `aws ecs update-service --cluster ... --service ... --task-definition <previous-taskdef-arn> --force-new-deployment`

**Database migrations and rollback:** Database migrations are **forward-only**. We do not roll back migrations. If a migration introduced a bug:
1. Deploy a new migration that corrects the schema.
2. Deploy the application fix.
Never attempt to run `dotnet ef database update <previous-migration>` in production — this would undo data.

---

## Secrets in CI

All secrets are stored in GitHub Actions Secrets at the repository or organization level. They are never hardcoded in workflow files.

AWS credentials use **OIDC** (OpenID Connect), not long-lived access keys. The GitHub Actions workflow assumes an IAM role scoped to exactly the permissions needed (ECR push, ECS update, API Gateway update). No AWS access keys are stored anywhere.

Secrets used in CI:
- `SLACK_BOT_TOKEN` — Slack notifications
- `DEV_TEST_PASSWORD` / `STAGING_TEST_PASSWORD` — E2E test user credentials
- No AWS access keys — uses OIDC role assumption

Test credentials (used in E2E tests) are dedicated test accounts in each environment. They have the minimum permissions needed for the test scenarios. Rotating them does not affect developer accounts.

---

## Branch Protection Rules

On `main`:
- Require PR reviews: 1 required approval
- Require status checks to pass: `backend`, `frontend`, `security-scan`
- Require branches to be up to date before merging
- Prevent force pushes
- Prevent deletion

---

_See also: [13 — Testing](./13-testing.md) for what tests run in CI, [10 — Scalability](./10-scalability.md) for auto-scaling configuration._
