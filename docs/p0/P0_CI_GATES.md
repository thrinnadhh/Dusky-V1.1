# P0 CI Gates

`p0-foundation.yml` runs on every PR and relevant push without path filtering. It grants only `contents: read`, cancels superseded runs, pins every action to an immutable commit, installs from the frozen pnpm lockfile, propagates command exit codes, and does not use `pull_request_target` or production secrets.

Checks are `repository-policy`, `legacy-inventory`, `contract-registry`, `customer-foundation`, `merchant-foundation`, `captain-foundation`, `admin-foundation`, `backend-foundation`, `cross-app-scenarios`, and `build-readiness`. Backend evidence includes real PostgreSQL Testcontainers execution and uploaded test/coverage reports. Build readiness exports each Expo web shell, builds Next.js production output, and creates the Spring Boot jar; it does not deploy.

Future CD must use protected environments, provenance-attested immutable artifacts, environment-specific migrations with backup/rollback evidence, separate deploy identities, post-deploy readiness/smoke checks, and explicit user-approved promotion. P0 provisions none of these services.
