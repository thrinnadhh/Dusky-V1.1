# PR Acceptance Requirements

A PR is reviewable only when its contract IDs and ownership are explicit; production behavior and tests land together; planned-to-active changes include executable paths; focused and full validations pass at the exact head; every CI job explicitly checks out and runtime-verifies the PR-head SHA; base-active contracts are compared canonically with the actual PR base SHA; migrations are forward-only and PostgreSQL-tested; authorization, isolation, idempotency, concurrency, offline, accessibility, and observability impacts are addressed; coverage remains at least 80%; and no disabled/focused/placeholder test exists.

The reviewer returns `APPROVE`, `CHANGES REQUIRED`, or `REJECT`. Approval is review evidence only. Only the user authorizes merge.
