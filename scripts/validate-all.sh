#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile
pnpm validate:repository
pnpm validate:legacy
pnpm validate:contracts
pnpm validate:scenarios
pnpm validate:test-integrity
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm --filter @dusky/customer-app config:validate
pnpm --filter @dusky/merchant-app config:validate
pnpm --filter @dusky/captain-app config:validate
pnpm --filter @dusky/admin-web config:validate
./gradlew :backend:test :backend:postgresTest :backend:jacocoTestCoverageVerification --no-daemon
pnpm --filter @dusky/customer-app build
pnpm --filter @dusky/merchant-app build
pnpm --filter @dusky/captain-app build
pnpm --filter @dusky/admin-web build
./gradlew :backend:bootJar --no-daemon

