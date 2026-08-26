# P0 Legacy Extraction Report

The public reference is cloned separately and detached at `817c6487cdbf18fc282dc0a44538d83e7bc5ef8b`; its push URL is disabled during local repair. The deterministic v2.1 extractor uses normalized source classification, explicit rule priorities, bounded word matching, and curated per-file/suite overrides. It rejects unresolved incompatible matches instead of selecting the first match. Reviewed multi-feature files may use an exact-file composite allowlist; ordinary lower-priority path rules cannot authorize a tie. Every generated entry records the selected rule and why lower-priority or co-equal candidates were resolved. Tooling is not treated as product E2E behavior.

The regenerated manifest contains 248 evidence files: 240 public pinned files reproducible in CI and eight local-uncommitted Customer files verified by SHA-256 only. It contains 1,163 individual entries and 73 architecture/contract/migration knowledge files.

| Disposition                         | Count |
| ----------------------------------- | ----: |
| `mapped`                            | 1,029 |
| `implementation-specific-rewritten` |   134 |
| `duplicate`                         |     0 |
| `obsolete-with-evidence`            |     0 |
| `requires-business-decision`        |     0 |

| Source module | Count |
| ------------- | ----: |
| Customer      |   492 |
| Merchant      |    51 |
| Captain       |   261 |
| Admin         |     0 |
| Backend       |   276 |
| E2E/tooling   |    83 |

All 45 entries extracted from the eight local files remain source-classified as Customer. The first five files contribute 36 mapped tests; the three additional candidates contribute nine implementation-specific tests rewritten as deterministic fixture or repository-isolation foundation evidence.

| Local evidence path                                                       | SHA-256                                                            | Entries and disposition               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `apps/customer-app/src/__tests__/customer-journey-contracts.test.ts`      | `8f388d0e7a120f34ae8e8a12b7e09805c60f54d250329a755d9d9e31c6c6ba18` | 11 `mapped`                           |
| `apps/customer-app/src/__tests__/food-filter-tags.test.ts`                | `77cefd926357557b385b4ac2596e9231be63308494e41d39343c7562b404fce9` | 2 `mapped`                            |
| `apps/customer-app/src/__tests__/p5-product-detail-cart-contract.test.ts` | `0ed89ae10eed619e63394a225c18933e09fac4d14568c944688732b20d18f8cd` | 14 `mapped`                           |
| `apps/customer-app/src/__tests__/s12-commerce.test.ts`                    | `d30528005c1ea212d1210a9ea643ad93f6e4ac83e2df78c264bb260c7147d224` | 4 `mapped`                            |
| `apps/customer-app/src/services/__tests__/paginated-catalog.test.ts`      | `8f76f2ae6044d22b1a8befce41b97f2779632df86abed1290f9499dacc088461` | 5 `mapped`                            |
| `apps/customer-app/src/demo/__tests__/customer-data.test.ts`              | `9ec39b175574b21faacb1a99021abf04dec8dc3397ce9f788c0046072a6bf3e8` | 3 `implementation-specific-rewritten` |
| `apps/customer-app/src/__tests__/demo-isolation-architecture.test.ts`     | `7d7afabe7fd0cb7a61aa04db0941cc01d4f64a76fc374ebc2b07a31b89f171ed` | 3 `implementation-specific-rewritten` |
| `apps/customer-app/src/services/__tests__/backend-capabilities.test.ts`   | `b52eca481a66537acc3f338603af392d35c4cfefc5e734ab5e938a321b6c1d19` | 3 `implementation-specific-rewritten` |

Representative repaired mappings include Customer refresh/401 concurrency to `BE-AUTH-001`, `CUS-AUTH-001`, and `CUS-SES-001`; safe transport retry and `Retry-After` to `BE-RATE-001` and `CUS-OFF-001`; pagination to `BE-PAGE-001` and `CUS-PROV-001`; product detail/cart evidence to `CUS-PDP-001`, `CUS-CART-001`, and `CUS-CART-002`; server-owned payment identity/amount to `BE-PAY-001` and `CUS-PAY-001`; and install/lint/workflow commands to `FOUND-CI-001` with `implementation-specific-rewritten` disposition. No `src/services` substring implies appointment behavior.

Second-round semantic corrections include app-config tests containing “production” to `FOUND-CI-001` rather than product discovery; FavouritesContext guest/server migration to `CUS-FAV-001`; Captain concurrent 401 refresh to `CAP-AUTH-001`; invalid/out-of-range coordinates to `CAP-GPS-001`; and Captain money/null/undefined utilities to `BE-REPR-001`. Generic accept/reject wording no longer implies assignment. Real overlapping checkout/payment/reward fixtures and synthetic paths matching ordinary suite rules are rejected unless an exact-file composite override is present. The regenerated inventory contains 189 reviewed composite entries: 83 Customer, three Merchant, 21 Captain, and 82 Backend. Each records its module-specific `*-REVIEWED-COMPOSITE-FILES` rule and the complete contributing feature-rule set.

Reproduce generation and verification with:

```bash
node scripts/extract-legacy-tests.mjs --source /path/to/detached/Mypetnew --preserved-root /path/to/read-only/dirty/Mypetnew
MYPETNEW_PATH=/path/to/detached/Mypetnew MYPETNEW_PRESERVED_PATH=/path/to/read-only/dirty/Mypetnew pnpm validate:legacy
```

GitHub CI independently checks out the public reference at the pinned SHA and rehashes its tracked content. CI validates committed local-only metadata but does not claim to possess or reverify uncommitted source content.
