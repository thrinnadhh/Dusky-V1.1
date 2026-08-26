# P0 Contract Catalog

The schema-v2 generated registry contains 110 contracts: 11 active P0 foundations and 99 planned product contracts. Of the planned contracts, 88 are launch-critical specifications and 11 are P1 specifications.

| Domain        | Planned | P0 launch |  P1 | Scenario catalog                    |
| ------------- | ------: | --------: | --: | ----------------------------------- |
| Customer      |      22 |        20 |   2 | `contracts/scenarios/customer.json` |
| Merchant      |      19 |        16 |   3 | `contracts/scenarios/merchant.json` |
| Captain       |      15 |        14 |   1 | `contracts/scenarios/captain.json`  |
| Admin         |      15 |        12 |   3 | `contracts/scenarios/admin.json`    |
| Backend       |      18 |        16 |   2 | `contracts/scenarios/backend.json`  |
| Cross-app/E2E |      10 |        10 |   0 | `contracts/scenarios/e2e.json`      |

Every planned record declares real actor categories, ownership, feature-specific preconditions, state transitions, database invariants, proposed HTTP or named internal interfaces, request/response fields, domain errors, structured applicability, test expectations, activation evidence, exact decision references, and reciprocal exact-ID provenance. Safe reads explicitly mark mutation idempotency not applicable; backend-only behavior explains why visual accessibility is not applicable; decision-dependent portions are blocked by exact `BD-*` IDs.

On pull requests, `validate-contracts.mjs --base-sha <base>` reads `contracts.json` from the fetched Git base and protects every base-active record against deletion, downgrade, version regression, or unapproved semantic change. `active-baseline.json` is only a convenience snapshot and is not the protection authority.

Run `node scripts/generate-contract-catalog.mjs` only when intentionally revising `contract-catalog-source.mjs`, then review the complete generated diff. Run `pnpm validate:contracts`, `pnpm validate:scenarios`, and the catalog quality tests after every change.
