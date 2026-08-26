# P0 Architecture

Dusky-V1.1 begins from the independent bootstrap commit `de300e3da2fafb5a50328769b8feaa6fe69b3850`. It has no shared Git ancestry with MyPetNew. P0 implements only a green foundation: three Expo/React Native shells, one Next.js admin shell, a Kotlin/Spring Boot backend shell, PostgreSQL/Flyway infrastructure, shared TypeScript contracts, deterministic fixtures, registry validation, and CI policy.

The runtime boundary is backend-authoritative. Mobile and web clients consume versioned shared DTO schemas and never become authoritative for identity, roles, tenant/outlet scope, price, inventory, loyalty, payment, or state transitions. PostgreSQL is the canonical durable store; outbound payment, SMS, FCM, and storage are represented only by fakes in P0 tests.

Planned product behavior lives in schema-v2 `contracts/registry/contracts.json` and the six scenario catalogs. The version-controlled source defines real proposed interactions, actors, states, errors, structured applicability, exact decision blockers, activation evidence, and reciprocal legacy IDs. Planned records are specifications, not mock feature implementations. They remain non-executable until an implementation PR supplies production code and every required test layer.

Package management uses one root pnpm workspace and one `pnpm-lock.yaml`. Java 21, Kotlin 2.3.21, Spring Boot 4.1.0, Gradle 9.6, Expo 57, React Native 0.86, and Next.js 16 form the greenfield foundation. These choices reuse ecosystem evidence from the pinned source without copying its application implementation.
