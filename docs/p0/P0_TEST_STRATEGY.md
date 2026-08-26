# P0 Test Strategy

P0 follows `GREEN FOUNDATION + PLANNED SCENARIOS`.

Active tests prove that each module installs, typechecks, renders or starts, uses shared contracts, and fails correctly. The backend test profile boots without provider calls, exposes health/readiness, and returns the shared error envelope. A tagged Testcontainers test executes against PostgreSQL. Shared fixtures provide stable time, UUIDs, identities, and fake payment/message/storage adapters.

The contract and scenario validators reject duplicate IDs, schema failures, missing scenarios, active contracts without tests, any non-allowlisted base-active semantic change, one-way or generic provenance, shallow launch criteria, fake endpoints/actors, mutation language on safe GETs, generic applicability, cross-domain boilerplate, invalid decision references, and malformed, expired, or non-user-authorized exceptions. Multi-stage E2E gates require the complete ordered order/appointment checkpoint sets and detailed actors, interactions, fields, invariants, correlation rules, app visibility, stable failures, and decision blockers. Test-integrity validation uses syntax-aware JavaScript/TypeScript checks and comment/string-masked Kotlin checks to reject focused, skipped, todo, disabled, ignored, empty, no-case, placeholder, suppressed-exit, and zero-test-bypass forms.

Repository-policy tests also treat exact-head execution as a testable contract: every job must explicitly checkout the expected PR-head/push SHA, print expected and actual values from `git rev-parse HEAD`, and fail on mismatch. Removing any part of this proof is adversarially rejected.

Feature tests are not created in P0. Each planned scenario specifies the future unit, component, integration, contract, PostgreSQL, and E2E evidence required for activation. The 80% line-coverage gate applies to every active JavaScript package and the covered backend foundation classes.

Full validation must run twice in independent clean detached worktrees at the same committed SHA, with public pinned evidence checked out separately and the eight local hashes verified read-only when available. Adversarial checks operate only on temporary fixtures/worktrees and must prove every policy failure without contaminating the branch.
