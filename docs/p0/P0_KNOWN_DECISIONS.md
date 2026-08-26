# P0 Known Decisions

The following rules are supported by pinned legacy evidence and adopted as planned V1.1 contracts, not implemented P0 product behavior:

- Guest browsing remains public; protected account and checkout actions require authentication (`T2A_CUSTOMER_AUTH_SESSION_CONTRACT.md`, `T2B_CUSTOMER_CATALOG_CONTRACT.md`).
- A cart/reorder remains single merchant/outlet (`CUSTOMER_PRODUCTION_10_PLAN_ROADMAP.md`, `CUSTOMER_COMMERCE.md`).
- Serviceability uses a normalized six-digit Indian PIN (`P3B_DISCOVERY_FILTER_CONTRACT.md`, backend provider domain).
- Medicine is discoverable but `VIEW_ONLY` in V1 and is server-rejected from cart, order, POS, delivery, and recurring commerce (`PRD.md`, `SERVICES_RECURRING.md`).
- The backend owns prices, fees, discounts, stock, serviceability, payment state, and business transitions (`CUSTOMER_COMMERCE.md`).
- Inventory is canonical and its movement ledger is append-only (`PRD.md`, `MERCHANT_BARCODE_POS_LOYALTY.md`, V25 migration).
- Eligible verified purchases award one merchant-scoped star; ten consumed stars issue one reward, including under concurrency (`PRD.md`, loyalty contract tests).
- Checkout may combine at most one valid normal coupon and one valid same-merchant reward (`PRD.md`).
- Recurring cadence evidence is 7/15/25/30/35 days; schedules create confirmation-required proposals and confirmation revalidates current commercial state (`CUSTOMER_PRODUCTION_10_PLAN_ROADMAP.md`, `SERVICES_RECURRING.md`).
- State-changing commands and payment/refund flows are idempotent; payment provider webhooks are authoritative for provider settlement state (`PRD.md`, payment contracts).
- Roles and outlet/tenant ownership are always enforced by the server (`SECURITY_ARCHITECTURE.md`, merchant authority contracts).
