import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateSemanticCatalog } from './validate-scenarios.mjs';

const contract = (overrides = {}) => ({
  contractId: 'CUS-DISC-001',
  title: 'Guest browsing',
  domain: 'Customer',
  criticality: 'launch-critical',
  ...overrides,
});

const scenario = (overrides = {}) => ({
  scenarioId: 'SCN-CUS-DISC-001',
  contractIds: ['CUS-DISC-001'],
  priority: 'P0-launch',
  actors: {
    initiators: ['guest customer'],
    allowed: ['guest customer', 'authenticated customer'],
    denied: ['suspended customer'],
  },
  given: ['A published catalog exists for postal code 500081.', 'No customer session is required.'],
  when: ['The guest requests the home catalog.', 'The client supplies postalCode and locale.'],
  then: [
    'The response contains only published and serviceable listings.',
    'The request creates no cart, order, or audit mutation.',
    'Images include an accessible text alternative or deterministic fallback.',
  ],
  stateTransitions: [
    {
      from: 'catalog unchanged',
      to: 'catalog unchanged',
      trigger: 'GET /api/v1/catalog/home returns a projection',
    },
  ],
  apiRequest: {
    kind: 'http',
    method: 'GET',
    path: '/api/v1/catalog/home',
    fields: ['postalCode', 'locale'],
  },
  apiResponse: { fields: ['sections', 'providers', 'listings', 'nextCursor'] },
  errorCodes: ['CATALOG_UNAVAILABLE', 'POSTAL_CODE_INVALID'],
  databaseInvariant: 'Catalog rows and business state remain unchanged by this read-only request.',
  applicability: {
    idempotency: {
      status: 'not-applicable',
      reason: 'The operation is a safe GET and creates no business result.',
    },
    concurrency: {
      status: 'applicable',
      reason: 'A single response must use one committed catalog snapshot.',
    },
    offlineRetry: {
      status: 'applicable',
      reason: 'The client may retry the safe read and show a labelled cached snapshot.',
    },
  },
  featureBehavior: [
    'Guest discovery filters unpublished, unserviceable, and cross-outlet listings before response.',
  ],
  evidenceRequiredToActivate: [
    'Executable public-access, filtering, empty-state, and screen-reader tests at the final SHA.',
  ],
  ...overrides,
});

test('accepts a feature-specific public read scenario', () => {
  assert.doesNotThrow(() =>
    validateSemanticCatalog({ contracts: [contract()], scenarios: [scenario()] }),
  );
});

test('rejects authenticated preconditions for guest browsing and OTP initiation', () => {
  const guest = scenario({
    given: ['An authenticated customer session exists.', 'A published catalog exists.'],
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [contract()], scenarios: [guest] }),
    /guest browsing.*authenticated/i,
  );

  const otpContract = contract({
    contractId: 'CUS-AUTH-001',
    title: 'Mobile authentication and OTP',
  });
  const otp = scenario({
    scenarioId: 'SCN-CUS-AUTH-001',
    contractIds: ['CUS-AUTH-001'],
    actors: {
      initiators: ['unauthenticated customer'],
      allowed: ['unauthenticated customer'],
      denied: ['rate-limited phone number'],
    },
    given: ['An authenticated customer is already signed in.', 'The phone number is valid.'],
    apiRequest: {
      kind: 'http',
      method: 'POST',
      path: '/api/v1/auth/otp/requests',
      fields: ['phoneNumber', 'purpose'],
    },
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [otpContract], scenarios: [otp] }),
    /OTP initiation.*authenticated/i,
  );
});

test('rejects mutation semantics on GETs, placeholder endpoints, and artificial E2E actors', () => {
  const mutatingRead = scenario({
    databaseInvariant: 'The authoritative result is persisted exactly once.',
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [contract()], scenarios: [mutatingRead] }),
    /read-only GET.*persist/i,
  );

  const placeholder = scenario({
    apiRequest: {
      kind: 'http',
      method: 'GET',
      path: '/v1/contracts/cus-disc-001',
      fields: ['postalCode'],
    },
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [contract()], scenarios: [placeholder] }),
    /placeholder endpoint/i,
  );

  const e2eContract = contract({
    contractId: 'E2E-ORDER-001',
    title: 'Customer order through delivery',
    domain: 'E2E',
  });
  const e2e = scenario({
    scenarioId: 'SCN-E2E-ORDER-001',
    contractIds: ['E2E-ORDER-001'],
    actors: {
      initiators: ['Owning E2E role'],
      allowed: ['Owning E2E role'],
      denied: ['different role'],
    },
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [e2eContract], scenarios: [e2e] }),
    /artificial actor/i,
  );
});

test('rejects unexplained applicability and incomplete launch scenarios', () => {
  const generic = scenario();
  generic.applicability.idempotency.reason = 'Applies where applicable.';
  assert.throws(
    () => validateSemanticCatalog({ contracts: [contract()], scenarios: [generic] }),
    /generic applicability/i,
  );

  const incomplete = scenario({
    actors: { initiators: [], allowed: [], denied: [] },
    stateTransitions: [],
    errorCodes: [],
  });
  assert.throws(
    () => validateSemanticCatalog({ contracts: [contract()], scenarios: [incomplete] }),
    /launch scenario.*actors|state|errors/i,
  );
});

test('rejects normalized boilerplate duplicated across unrelated contracts', () => {
  const otherContract = contract({
    contractId: 'MER-INV-001',
    title: 'Canonical inventory',
    domain: 'Merchant',
  });
  const duplicate = structuredClone(scenario());
  duplicate.scenarioId = 'SCN-MER-INV-001';
  duplicate.contractIds = ['MER-INV-001'];
  assert.throws(
    () =>
      validateSemanticCatalog({
        contracts: [contract(), otherContract],
        scenarios: [scenario(), duplicate],
      }),
    /duplicated semantic boilerplate/i,
  );
});

const e2eCatalog = () =>
  JSON.parse(
    readFileSync(new URL('../contracts/scenarios/e2e.json', import.meta.url), 'utf8'),
  );
const registry = () =>
  JSON.parse(
    readFileSync(new URL('../contracts/registry/contracts.json', import.meta.url), 'utf8'),
  );

const requiredLifecycleFields = [
  'checkpoint',
  'initiatingActor',
  'authorizedActors',
  'from',
  'to',
  'trigger',
  'interaction',
  'databaseInvariant',
  'idempotencyAndCorrelation',
  'visibility',
  'failureResult',
  'businessDecisionRefs',
];

test('committed order and appointment scenarios contain implementation-ready checkpoints', () => {
  const scenarios = e2eCatalog().scenarios;
  const expected = {
    'SCN-E2E-ORDER-001': [
      'quote-cart-confirmation',
      'merchant-acceptance',
      'merchant-rejection',
      'inventory-reservation',
      'captain-assignment',
      'captain-acceptance',
      'pickup',
      'delivery',
      'cancellation-failure-compensation',
      'terminal-visibility',
    ],
    'SCN-E2E-APT-001': [
      'slot-availability',
      'slot-hold',
      'booking',
      'merchant-confirmation',
      'merchant-rejection',
      'completion',
      'cancellation',
      'no-show',
      'refund-compensation',
      'terminal-visibility',
    ],
  };
  for (const [scenarioId, checkpoints] of Object.entries(expected)) {
    const candidate = scenarios.find((item) => item.scenarioId === scenarioId);
    assert.deepEqual(
      candidate.stateTransitions.map(({ checkpoint }) => checkpoint),
      checkpoints,
    );
    for (const transition of candidate.stateTransitions) {
      for (const field of requiredLifecycleFields)
        assert.ok(field in transition, `${scenarioId} ${transition.checkpoint} lacks ${field}`);
      assert.deepEqual(Object.keys(transition.visibility).sort(), [
        'Admin',
        'Captain',
        'Customer',
        'Merchant',
      ]);
    }
  }
});

test('semantic gate rejects missing multi-stage E2E checkpoints', () => {
  const catalog = e2eCatalog();
  const contracts = registry().contracts;
  for (const [scenarioId, checkpoint] of [
    ['SCN-E2E-ORDER-001', 'pickup'],
    ['SCN-E2E-APT-001', 'no-show'],
  ]) {
    const candidate = structuredClone(
      catalog.scenarios.find((item) => item.scenarioId === scenarioId),
    );
    candidate.stateTransitions = candidate.stateTransitions.filter(
      (transition) => transition.checkpoint !== checkpoint,
    );
    assert.throws(
      () => validateSemanticCatalog({ contracts, scenarios: [candidate] }),
      new RegExp(`checkpoint.*${checkpoint}|${checkpoint}.*checkpoint`, 'i'),
    );
  }
});
