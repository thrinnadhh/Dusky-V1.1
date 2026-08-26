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

The launch order and appointment cross-app scenarios each contain ten ordered, machine-validated checkpoints. Every checkpoint identifies the initiating and authorized actors, source/destination state, HTTP or event interaction and fields, atomic database invariant, idempotency/correlation rule, Customer/Merchant/Captain/Admin visibility, stable failure result, applicability condition, and exact business-decision blockers. Order covers quote/cart confirmation, merchant acceptance and rejection, inventory reservation, captain assignment and acceptance, pickup, delivery, cancellation/failure compensation, and terminal visibility. Appointment covers availability, hold, booking, merchant confirmation and rejection, completion, cancellation, no-show, refund compensation, and terminal visibility.

On pull requests, `validate-contracts.mjs --base-sha <base>` reads `contracts.json` from the fetched Git base and protects every base-active record against deletion, downgrade, version regression, or unapproved semantic change. Protection compares the full canonical active record and allowlists only forward version metadata; domain, criticality, decisions, provenance, implementation workstream, API, behavioral, state, database, security, test, and newly introduced semantic fields fail closed. A semantic change requires an exact contract-scoped, unexpired `USER-AUTH-*` exception with owner, reason, and migration plan. `active-baseline.json` is only a convenience snapshot and is not the protection authority.

Run `node scripts/generate-contract-catalog.mjs` only when intentionally revising `contract-catalog-source.mjs`, then review the complete generated diff. Run `pnpm validate:contracts`, `pnpm validate:scenarios`, and the catalog quality tests after every change.
