# P0 Open Business Decisions

These questions block later launch-contract activation but do not block the P0 foundation:

1. **BD-001 — Checkout launch scope:** pinned Sprint-1 checkout evidence limits live checkout to pickup plus pay-on-fulfilment, while the broader PRD plans delivery, COD, UPI/card, and recovery. Product must select the V1.1 launch matrix.
2. **BD-002 — Fees:** the PRD names a ₹10 customer platform fee in one quote example, but the final customer fee, merchant fee, tax treatment, waiver rules, and disclosure copy are not consistently fixed.
3. **BD-003 — Loyalty configuration:** evidence supports one star, ten-star issuance, merchant scope, one reward plus one coupon, and a 90-day roadmap expiry; the reward benefit types, merchant configuration bounds, minimum transaction defaults, and authoritative expiry rule need approval.
4. **BD-004 — Appointment lifecycle:** the roadmap explicitly marks the final status enum for Merchant workflow approval, including cancellation/no-show authority and refund timing.
5. **BD-005 — Payment/COD policy:** supported methods by fulfilment mode, COD collection proof, cash discrepancy handling, webhook timeout/recovery windows, and refund SLAs remain unsettled.
6. **BD-006 — OTP abuse controls:** attempt limits, resend windows, lockout duration, provider fallback, and support override policy require security/product approval.
7. **BD-007 — Captain tracking:** background sampling frequency, retention, customer visibility window, permission-denial fallback, and battery constraints need privacy/product approval.
8. **BD-008 — Admin overrides:** which order, appointment, inventory, loyalty, and payment states are overrideable—and required dual control—remain undefined.
9. **BD-009 — Destructive actions and retention:** soft-delete windows, irreversible deletion confirmation, audit retention, and legal holds need policy approval.
10. **BD-010 — Notification/deep-link policy:** event priority, expiry, duplicate suppression, and the exact authoritative fallback destination remain to be defined.
