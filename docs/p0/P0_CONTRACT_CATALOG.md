# P0 Contract Catalog

The generated registry contains 110 contracts: 11 active P0 foundations and 99 planned product contracts.

| Domain        | Planned contracts | Scenario catalog                    |
| ------------- | ----------------: | ----------------------------------- |
| Customer      |                22 | `contracts/scenarios/customer.json` |
| Merchant      |                19 | `contracts/scenarios/merchant.json` |
| Captain       |                15 | `contracts/scenarios/captain.json`  |
| Admin         |                15 | `contracts/scenarios/admin.json`    |
| Backend       |                18 | `contracts/scenarios/backend.json`  |
| Cross-app/E2E |                10 | `contracts/scenarios/e2e.json`      |

Every record declares producer, consumers, owner, success/error behavior, authorization, isolation, idempotency, concurrency, offline/retry, observability, accessibility, provenance, workstream, required test layers, and active executable paths. `active-baseline.json` makes downgrade or silent deletion a hard failure.

Run `node scripts/generate-contract-catalog.mjs` only when intentionally revising the catalog, then review the complete generated diff. Run `pnpm validate:contracts` and `pnpm validate:scenarios` after every change.
