# P0 Test Strategy

P0 follows `GREEN FOUNDATION + PLANNED SCENARIOS`.

Active tests prove that each module installs, typechecks, renders or starts, uses shared contracts, and fails correctly. The backend test profile boots without provider calls, exposes health/readiness, and returns the shared error envelope. A tagged Testcontainers test executes against PostgreSQL. Shared fixtures provide stable time, UUIDs, identities, and fake payment/message/storage adapters.

The contract and scenario validators reject duplicate IDs, schema failures, missing scenarios, active contracts without tests, active downgrades/deletions, broken provenance, shallow launch criteria, and expired exceptions. Test-integrity validation rejects focused/skipped/todo/disabled tests, empty tests, placeholder assertions, missing app modules, and missing test commands.

Feature tests are not created in P0. Each planned scenario specifies the future unit, component, integration, contract, PostgreSQL, and E2E evidence required for activation. The 80% line-coverage gate applies to every active JavaScript package and the covered backend foundation classes.

Full validation must run twice at the same committed SHA. Adversarial checks operate only on temporary fixtures/worktrees and must prove every policy failure without contaminating the branch.
