import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sourceSha = '817c6487cdbf18fc282dc0a44538d83e7bc5ef8b';

const groups = {
  Customer: [
    ['CUS-DISC-001', 'Guest browsing'],
    ['CUS-AUTH-001', 'Mobile authentication and OTP'],
    ['CUS-SES-001', 'Session restoration and logout'],
    ['CUS-PROV-001', 'Provider and catalog discovery'],
    ['CUS-SVC-001', 'Six-digit PIN serviceability'],
    ['CUS-SEARCH-001', 'Search and filtering'],
    ['CUS-PDP-001', 'Product detail'],
    ['CUS-FAV-001', 'Favourites'],
    ['CUS-CART-001', 'One-outlet cart totals and persistence'],
    ['CUS-CART-002', 'Price and stock revalidation'],
    ['CUS-CHK-001', 'Authenticated checkout'],
    ['CUS-PRICE-001', 'Fees coupons and rewards'],
    ['CUS-PAY-001', 'COD and payment recovery'],
    ['CUS-ORD-001', 'Order history and detail'],
    ['CUS-APT-001', 'Grooming and veterinary discovery'],
    ['CUS-APT-002', 'Appointment booking payment and history'],
    ['CUS-PROF-001', 'Profile pets and addresses'],
    ['CUS-LOY-001', 'Customer loyalty'],
    ['CUS-REC-001', 'Recurring-order proposals'],
    ['CUS-NOT-001', 'Notifications and deep links'],
    ['CUS-OFF-001', 'Offline and reconnect'],
    ['CUS-A11Y-001', 'Navigation and accessibility'],
  ],
  Merchant: [
    ['MER-AUTH-001', 'Merchant authentication'],
    ['MER-OUTLET-001', 'Outlet isolation'],
    ['MER-DASH-001', 'Merchant dashboard'],
    ['MER-CAT-001', 'Product CRUD categories and images'],
    ['MER-BAR-001', 'Barcode scanning and uniqueness'],
    ['MER-INV-001', 'Canonical inventory'],
    ['MER-MOV-001', 'Append-only inventory movements'],
    ['MER-REC-001', 'Receiving adjustments and counts'],
    ['MER-OFF-001', 'Online and offline inventory updates'],
    ['MER-SYNC-001', 'Sync queue replay and conflicts'],
    ['MER-MULTI-001', 'Multi-device synchronization'],
    ['MER-AVAIL-001', 'Customer availability propagation'],
    ['MER-ORD-001', 'Merchant orders'],
    ['MER-APT-001', 'Merchant appointments'],
    ['MER-POS-001', 'Point of sale'],
    ['MER-LOY-001', 'Merchant loyalty'],
    ['MER-NOT-001', 'Merchant notifications'],
    ['MER-AUD-001', 'Merchant audit history'],
    ['MER-A11Y-001', 'Merchant accessibility'],
  ],
  Captain: [
    ['CAP-AUTH-001', 'Captain authentication'],
    ['CAP-AVAIL-001', 'Online and offline availability'],
    ['CAP-ASG-001', 'Assignment reception ownership and expiry'],
    ['CAP-CON-001', 'Accept and reject concurrency'],
    ['CAP-STATE-001', 'Pickup and delivery state transitions'],
    ['CAP-IDEMP-001', 'Duplicate captain actions'],
    ['CAP-STALE-001', 'Stale response handling'],
    ['CAP-OFF-001', 'Captain offline and reconnect'],
    ['CAP-NOT-001', 'Captain push and deep links'],
    ['CAP-GPS-001', 'GPS permissions and background tracking'],
    ['CAP-POD-001', 'Proof of delivery'],
    ['CAP-COD-001', 'Cash on delivery'],
    ['CAP-CAN-001', 'Delivery cancellation'],
    ['CAP-LIFE-001', 'Android lifecycle recovery'],
    ['CAP-A11Y-001', 'Captain accessibility'],
  ],
  Admin: [
    ['ADM-AUTH-001', 'Admin authentication'],
    ['ADM-RBAC-001', 'RBAC and route protection'],
    ['ADM-MER-001', 'Merchant and outlet management'],
    ['ADM-USER-001', 'Customer and captain management'],
    ['ADM-CAT-001', 'Category and catalog moderation'],
    ['ADM-VIS-001', 'Product visibility'],
    ['ADM-ORD-001', 'Admin order operations'],
    ['ADM-APT-001', 'Admin appointment operations'],
    ['ADM-LOY-001', 'Loyalty and coupon configuration'],
    ['ADM-OVR-001', 'Controlled overrides'],
    ['ADM-AUD-001', 'Admin audit logs'],
    ['ADM-SEARCH-001', 'Search and pagination'],
    ['ADM-DEST-001', 'Safe destructive actions'],
    ['ADM-INV-001', 'Inventory authority limitations'],
    ['ADM-RESP-001', 'Responsive browser accessibility'],
  ],
  Backend: [
    ['BE-AUTH-001', 'Authentication and authorization'],
    ['BE-OBJ-001', 'Object-level authorization'],
    ['BE-TENANT-001', 'Tenant and outlet isolation'],
    ['BE-VALID-001', 'Request validation'],
    ['BE-PAGE-001', 'Pagination'],
    ['BE-REPR-001', 'UUID money and time representation'],
    ['BE-IDEMP-001', 'Idempotent commands'],
    ['BE-CON-001', 'Concurrency control'],
    ['BE-STATE-001', 'Authoritative state machines'],
    ['BE-INV-001', 'Inventory authority'],
    ['BE-PAY-001', 'Payment and webhook authority'],
    ['BE-OTP-001', 'OTP abuse protection'],
    ['BE-NOT-001', 'Notification payloads'],
    ['BE-AUD-001', 'Audit records'],
    ['BE-MIG-001', 'Versioned PostgreSQL migrations'],
    ['BE-CORS-001', 'CORS policy'],
    ['BE-RATE-001', 'Rate limits'],
    ['BE-LOG-001', 'Structured logging'],
  ],
  E2E: [
    ['E2E-INV-001', 'Merchant inventory to Customer availability'],
    ['E2E-ORDER-001', 'Customer order to Merchant to Captain to delivered history'],
    ['E2E-APT-001', 'Customer appointment through Merchant processing'],
    ['E2E-POS-001', 'Merchant POS to inventory and loyalty'],
    ['E2E-MOD-001', 'Admin moderation visibility propagation'],
    ['E2E-OFF-001', 'Offline replay and idempotent reconciliation'],
    ['E2E-IDEMP-001', 'Duplicate command produces one business result'],
    ['E2E-AUTH-001', 'Cross-role and cross-tenant rejection'],
    ['E2E-PAY-001', 'Payment webhook authority to Customer history'],
    ['E2E-NOT-001', 'Notification deep link to authoritative state'],
  ],
};

const activeDefinitions = [
  [
    'FOUND-APP-CUS-001',
    'Customer application bootstrap',
    'Customer',
    ['apps/customer-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-MER-001',
    'Merchant application bootstrap',
    'Merchant',
    ['apps/merchant-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-CAP-001',
    'Captain application bootstrap',
    'Captain',
    ['apps/captain-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-ADM-001',
    'Admin application bootstrap',
    'Admin',
    ['apps/admin-web/src/page.test.tsx'],
  ],
  [
    'FOUND-BE-HEALTH-001',
    'Backend health and readiness',
    'Backend',
    ['backend/src/test/kotlin/in/dusky/foundation/FoundationApplicationTest.kt'],
  ],
  [
    'FOUND-BE-ERROR-001',
    'Standard API error envelope',
    'Backend',
    [
      'backend/src/test/kotlin/in/dusky/foundation/FoundationApplicationTest.kt',
      'packages/contracts/src/index.test.ts',
    ],
  ],
  [
    'FOUND-DB-001',
    'PostgreSQL integration harness',
    'Backend',
    ['backend/src/test/kotlin/in/dusky/foundation/PostgresFoundationTest.kt'],
  ],
  ['FOUND-CON-001', 'Shared contract schemas', 'E2E', ['packages/contracts/src/index.test.ts']],
  [
    'FOUND-FIX-001',
    'Deterministic fixtures and fake providers',
    'E2E',
    ['packages/test-kit/src/index.test.ts'],
  ],
  [
    'FOUND-REG-001',
    'Contract and scenario registry validation',
    'E2E',
    ['scripts/validate-contracts.test.mjs'],
  ],
  [
    'FOUND-CI-001',
    'Test integrity and repository policy',
    'E2E',
    ['scripts/validate-test-integrity.test.mjs'],
  ],
];

const ownership = {
  Customer: ['customer-app'],
  Merchant: ['merchant-app'],
  Captain: ['captain-app'],
  Admin: ['admin-web'],
  Backend: ['backend'],
  E2E: ['backend', 'all-apps'],
};

const launchCritical = (id) => !/(A11Y|DASH|RESP|SEARCH|AUD|LOG)-/.test(id);

const plannedContracts = Object.entries(groups).flatMap(([domain, definitions]) =>
  definitions.map(([id, title]) => ({
    contractId: id,
    title,
    domain,
    description: `${title} is server-authoritative and must preserve security, retry, and state invariants across supported clients.`,
    producer:
      domain === 'E2E'
        ? 'backend and initiating application'
        : domain === 'Backend'
          ? 'backend'
          : `${domain.toLowerCase()} application and backend`,
    consumers:
      domain === 'E2E'
        ? ['customer-app', 'merchant-app', 'captain-app', 'admin-web']
        : ownership[domain],
    owningModule: ownership[domain][0],
    status: 'planned',
    criticality: launchCritical(id) ? 'launch-critical' : 'high',
    version: '1.0.0',
    preconditions: [
      `Authenticated role and required fixture state exist for ${title.toLowerCase()}.`,
      'The request carries a trace ID and idempotency key when state-changing.',
    ],
    successBehavior: [
      `The authoritative result for ${title.toLowerCase()} is persisted exactly once.`,
      'All consumers observe the same versioned state.',
    ],
    errorBehavior: [
      'Invalid or stale input returns the standard error envelope without partial mutation.',
      'Retryable and terminal errors are distinguishable by stable codes.',
    ],
    authorization: [
      'Deny by default; authorize the role, resource, and action on the server.',
      'Reject cross-role access without revealing resource existence.',
    ],
    tenantOutletIsolation: [
      'Scope every read and mutation to the authenticated tenant/outlet where applicable.',
      'Cross-tenant identifiers return a non-enumerating denial.',
    ],
    idempotency: [
      'The same actor, operation, and idempotency key produce one business result.',
      'A reused key with a different payload is rejected.',
    ],
    concurrency: [
      'Concurrent conflicting commands have one deterministic winner.',
      'Losers receive the current authoritative version.',
    ],
    offlineRetryBehavior: [
      'Clients may queue only explicitly retryable commands.',
      'Reconnect revalidates authorization and authoritative state before reconciliation.',
    ],
    observabilityExpectations: [
      'Emit structured outcome, contract ID, actor class, trace ID, and latency without secrets.',
      'Expose an audit event for privileged or state-changing actions.',
    ],
    accessibilityExpectations: [
      'Expose semantic names, roles, state, focus order, and non-color status cues.',
      'Errors are announced and recovery remains keyboard/screen-reader operable.',
    ],
    legacyProvenance: [
      {
        sourceRepository: 'Mypetnew',
        sourceSha,
        sourcePath: 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json',
        note: 'Behavioral intent rewritten from mapped legacy tests; implementation is greenfield.',
      },
    ],
    plannedImplementationWorkstream: `${domain.toLowerCase()}-${id.toLowerCase()}`,
    requiredTestLayers: [
      'unit',
      'component',
      'integration',
      'contract',
      ...(domain === 'E2E' ? ['e2e'] : []),
    ],
    executableTestPaths: [],
  })),
);

const activeContracts = activeDefinitions.map(([id, title, domain, paths]) => ({
  contractId: id,
  title,
  domain,
  description: `${title} is implemented as a P0 foundation capability.`,
  producer:
    domain === 'Backend'
      ? 'backend'
      : domain === 'E2E'
        ? 'foundation tooling'
        : `${domain.toLowerCase()} application`,
  consumers: ownership[domain],
  owningModule: ownership[domain][0],
  status: 'active',
  criticality: 'foundation',
  version: '1.0.0',
  preconditions: ['The repository is installed from the frozen lockfile.'],
  successBehavior: [`${title} passes its executable foundation tests.`],
  errorBehavior: ['A missing module, malformed configuration, or failing test fails the gate.'],
  authorization: ['No production credentials are required or accepted.'],
  tenantOutletIsolation: ['No tenant data exists in P0 foundation fixtures.'],
  idempotency: ['Foundation validation is deterministic and repeatable.'],
  concurrency: ['Parallel CI jobs do not share mutable application state.'],
  offlineRetryBehavior: ['Validation can be rerun from a clean checkout.'],
  observabilityExpectations: ['The check emits a durable test report and process exit code.'],
  accessibilityExpectations: ['Bootstrap UI exposes semantic identity and errors.'],
  legacyProvenance: [
    {
      sourceRepository: 'greenfield',
      sourceSha: 'bootstrap',
      sourcePath: 'README.md',
      note: 'P0-only active foundation; no legacy implementation copied.',
    },
  ],
  plannedImplementationWorkstream: 'p0-foundation',
  requiredTestLayers: ['unit', 'integration'],
  executableTestPaths: paths,
}));

const scenarioFor = (contract) => ({
  scenarioId: `SCN-${contract.contractId}`,
  contractIds: [contract.contractId],
  priority: contract.criticality === 'launch-critical' ? 'P0-launch' : 'P1',
  given: [contract.preconditions[0], contract.preconditions[1]],
  when: [
    `The authorized actor attempts ${contract.title.toLowerCase()} with a versioned request.`,
    'The same operation is exercised once normally and once under retry or conflict.',
  ],
  then: [
    contract.successBehavior[0],
    contract.errorBehavior[0],
    'No unauthorized, duplicate, or partial business result is visible.',
  ],
  requiredFixtures: [
    'deterministic clock',
    'deterministic UUID sequence',
    'role and tenant identities',
    'minimal authoritative database state',
  ],
  apiRequest: {
    method: contract.contractId.startsWith('CUS-DISC') ? 'GET' : 'POST',
    path: `/v1/contracts/${contract.contractId.toLowerCase()}`,
    headers: ['Authorization', 'X-Trace-Id', 'Idempotency-Key when mutating'],
    body: `${contract.title} request DTO with explicit version`,
  },
  apiResponse: {
    success: 'Versioned authoritative resource/result DTO',
    failure: '{ error: { code, message, traceId, details? } }',
  },
  errorCodes: ['VALIDATION_ERROR', 'FORBIDDEN', 'CONFLICT', 'STALE_VERSION', 'NOT_FOUND'],
  authorizationMatrix: {
    allowed: [`Owning ${contract.domain} role with same tenant/outlet`],
    denied: [
      'anonymous unless explicitly public',
      'different role',
      'different tenant/outlet',
      'revoked session',
    ],
  },
  databaseInvariant: `For ${contract.title.toLowerCase()}, committed rows remain tenant-scoped, auditable, and represent one authoritative business result.`,
  duplicateRetryExpectation: contract.idempotency,
  concurrencyExpectation: contract.concurrency,
  offlineReconnectExpectation: contract.offlineRetryBehavior,
  accessibilityExpectation: contract.accessibilityExpectations,
  requiredUnitTests: [
    `Validate ${contract.title.toLowerCase()} decisions, boundaries, and stable error codes.`,
  ],
  requiredComponentTests: [
    `Render success, loading, empty, denied, stale, offline, and retry states for ${contract.title.toLowerCase()}.`,
  ],
  requiredIntegrationTests: [
    `Persist and reload ${contract.title.toLowerCase()} against PostgreSQL with tenant isolation.`,
  ],
  requiredContractTests: [
    `Validate request, response, error envelope, authorization, idempotency, and version semantics for ${contract.contractId}.`,
  ],
  requiredE2ETests: [
    `Exercise the owning-role journey and authoritative cross-app visibility for ${contract.title.toLowerCase()}.`,
  ],
  evidenceRequiredToActivate: [
    'production implementation paths',
    'executable test paths',
    'focused validation output',
    'full CI result at exact SHA',
    'coverage and migration evidence',
    'no unresolved launch-critical decision',
  ],
});

mkdirSync(join(root, 'contracts/registry'), { recursive: true });
mkdirSync(join(root, 'contracts/scenarios'), { recursive: true });
writeFileSync(
  join(root, 'contracts/registry/contracts.json'),
  `${JSON.stringify({ schemaVersion: '1.0.0', contracts: [...activeContracts, ...plannedContracts] }, null, 2)}\n`,
);
writeFileSync(
  join(root, 'contracts/registry/active-baseline.json'),
  `${JSON.stringify({ schemaVersion: '1.0.0', activeContractIds: activeContracts.map(({ contractId }) => contractId) }, null, 2)}\n`,
);
writeFileSync(
  join(root, 'contracts/registry/breaking-change-exceptions.json'),
  `${JSON.stringify({ schemaVersion: '1.0.0', exceptions: [] }, null, 2)}\n`,
);
for (const domain of Object.keys(groups)) {
  const contracts = plannedContracts.filter((contract) => contract.domain === domain);
  writeFileSync(
    join(root, 'contracts/scenarios', `${domain.toLowerCase()}.json`),
    `${JSON.stringify({ schemaVersion: '1.0.0', application: domain, scenarios: contracts.map(scenarioFor) }, null, 2)}\n`,
  );
}
console.log(
  `Generated ${activeContracts.length + plannedContracts.length} contracts and ${plannedContracts.length} planned scenarios.`,
);
