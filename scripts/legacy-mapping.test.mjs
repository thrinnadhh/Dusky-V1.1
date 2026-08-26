import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { classifyLegacyEvidence, normalizeSourcePath } from './legacy-mapping.mjs';

const classify = (sourcePath, originalTestName, testCategory = 'TypeScript/JavaScript test') =>
  classifyLegacyEvidence({ sourcePath, originalTestName, testCategory });

test('normalizes absolute and relative Customer paths without changing source classification', () => {
  const relative = 'apps/customer-app/src/services/__tests__/paginated-catalog.test.ts';
  assert.equal(normalizeSourcePath(relative), relative);
  assert.equal(normalizeSourcePath(`/Users/example/Mypetnew/${relative}`), relative);
  assert.equal(classify(relative, 'loads the next catalog page').sourceModule, 'Customer');
  assert.equal(
    classify(`/Users/example/Mypetnew/${relative}`, 'loads the next catalog page').sourceModule,
    'Customer',
  );
});

test('does not infer appointments from src/services', () => {
  const result = classify(
    'apps/customer-app/src/services/__tests__/unclassified-transport.test.ts',
    'handles an unusual protocol condition',
  );
  assert.notEqual(result.disposition, 'mapped');
  assert.ok(!result.targetDuskyContractIds.includes('CUS-APT-002'));
});

test('maps API refresh and transport evidence to auth/session/transport contracts', () => {
  const refresh = classify(
    'apps/customer-app/src/services/__tests__/api-client-refresh.test.ts',
    'coalesces concurrent 401 requests into one refresh and retries once',
  );
  assert.equal(refresh.disposition, 'mapped');
  assert.ok(refresh.targetDuskyContractIds.includes('CUS-AUTH-001'));
  assert.ok(refresh.targetDuskyContractIds.includes('BE-AUTH-001'));
  assert.ok(!refresh.targetDuskyContractIds.includes('CUS-APT-002'));

  const origin = classify(
    'apps/customer-app/src/services/__tests__/api-client-transport.test.ts',
    'never leaks the backend bearer token to an unrelated absolute origin',
  );
  assert.ok(origin.targetDuskyContractIds.includes('CUS-SES-001'));
  assert.ok(origin.targetDuskyContractIds.includes('BE-CORS-001'));
});

test('maps pagination, cart/product detail, and payment authority precisely', () => {
  const pagination = classify(
    'apps/customer-app/src/services/__tests__/paginated-catalog.test.ts',
    'appends pages without duplicating canonical listing IDs',
  );
  assert.deepEqual(pagination.targetDuskyContractIds, ['BE-PAGE-001', 'CUS-PROV-001']);

  const cart = classify(
    'apps/customer-app/src/__tests__/p5-product-detail-cart-contract.test.ts',
    'refreshes a stale price and clamps quantity to current stock',
  );
  assert.ok(cart.targetDuskyContractIds.includes('CUS-PDP-001'));
  assert.ok(cart.targetDuskyContractIds.includes('CUS-CART-002'));

  const payment = classify(
    'apps/customer-app/src/__tests__/customer-journey-contracts.test.ts',
    'keeps customer identity and payment amount server-authoritative',
  );
  assert.deepEqual(payment.targetDuskyContractIds, ['BE-PAY-001', 'CUS-PAY-001']);
});

test('classifies workflow commands as foundation evidence, never product-order E2E', () => {
  const workflow = classify(
    '.github/workflows/ci.yml',
    'CI: pnpm install --frozen-lockfile',
    'CI-only test command',
  );
  assert.equal(workflow.sourceModule, 'E2E');
  assert.equal(workflow.disposition, 'implementation-specific-rewritten');
  assert.deepEqual(workflow.targetDuskyContractIds, ['FOUND-CI-001']);
  assert.ok(!workflow.targetDuskyContractIds.includes('E2E-ORDER-001'));
});

test('ambiguous evidence is never automatically marked mapped', () => {
  const ambiguous = classify('apps/customer-app/src/__tests__/misc.test.ts', 'handles value');
  assert.notEqual(ambiguous.disposition, 'mapped');
  assert.match(ambiguous.dispositionEvidence, /manual|ambiguous|insufficient/i);
});

test('uses curated path semantics instead of broad production and product substrings', () => {
  for (const name of [
    '4. production environment allows production',
    '5. production environment is allowed',
  ]) {
    const result = classify('apps/customer-app/src/utils/__tests__/app-config.test.ts', name);
    assert.equal(result.mappingRuleId, 'CUS-UTILITIES-REWRITE');
    assert.equal(result.disposition, 'implementation-specific-rewritten');
    assert.deepEqual(result.targetDuskyContractIds, ['FOUND-CI-001']);
    assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  }
});

test('prefers feature-specific path evidence for favourites guest-to-server migration', () => {
  const result = classify(
    'apps/customer-app/src/context/__tests__/FavouritesContext.behavior.test.tsx',
    'migrates guest products to the server and guest shops into the signed-in account bucket',
  );
  assert.equal(result.mappingRuleId, 'CUS-FAVOURITES-SUITES');
  assert.deepEqual(result.targetDuskyContractIds, ['CUS-FAV-001']);
});

test('maps Captain refresh, coordinates, and money by bounded feature semantics', () => {
  const refresh = classify(
    'apps/captain-app/src/__tests__/auth/session.test.ts',
    '3. 20 concurrent 401 requests -> one refresh flight',
  );
  assert.equal(refresh.mappingRuleId, 'CAP-AUTH-SUITES');
  assert.deepEqual(refresh.targetDuskyContractIds, ['CAP-AUTH-001']);

  for (const [path, name] of [
    [
      'apps/captain-app/src/__tests__/features/location.test.ts',
      'rejects invalid or out of range coordinates',
    ],
    [
      'apps/captain-app/src/__tests__/level1-unit/state-machines/location-state-machine.test.ts',
      'rejects invalid or out of bound coordinates',
    ],
  ]) {
    const result = classify(path, name);
    assert.deepEqual(result.targetDuskyContractIds, ['CAP-GPS-001']);
  }

  for (const path of [
    'apps/captain-app/src/__tests__/level1-unit/utils/money.test.ts',
    'apps/captain-app/src/__tests__/utils/money.test.ts',
  ]) {
    const result = classify(path, 'gracefully handles null and undefined without throwing');
    assert.deepEqual(result.targetDuskyContractIds, ['BE-REPR-001']);
  }
});

test('generic accept and reject words do not imply assignment', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/misc.test.ts',
    'accepts valid input and rejects malformed input',
  );
  assert.notEqual(result.disposition, 'mapped');
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('rejects a real unresolved overlap instead of choosing the first rule', () => {
  assert.throws(
    () =>
      classify(
        'apps/customer-app/src/__tests__/misc.test.ts',
        'checkout payment and reward recovery',
      ),
    /incompatible.*CUS-PAYMENT.*CUS-CHECKOUT-PRICE/i,
  );
});

test('ordinary lower-priority path rules cannot authorize an incompatible tie', () => {
  assert.throws(
    () =>
      classify(
        'apps/customer-app/src/__tests__/customer-checkout-contract.test.ts',
        'persists payment after quote confirmation',
      ),
    /incompatible.*CUS-PAYMENT.*CUS-CHECKOUT-PRICE/i,
  );
});

test('records an auditable resolution reason for every automatic mapping', () => {
  const result = classify(
    'apps/customer-app/src/context/__tests__/FavouritesContext.behavior.test.tsx',
    'migrates guest products to the server',
  );
  assert.match(result.mappingResolutionReason, /priority|specific|override/i);
});

test('committed inventory records the selected rule and resolution reason', () => {
  const inventory = JSON.parse(
    readFileSync(new URL('../contracts/legacy/MYPETNEW_TEST_INVENTORY.json', import.meta.url)),
  );
  for (const entry of inventory.tests) {
    assert.ok(entry.mappingRuleId, `${entry.legacyTestId} lacks a selected mapping rule`);
    assert.match(
      entry.mappingResolutionReason,
      /selected|resolved|manual|override/i,
      `${entry.legacyTestId} lacks an auditable mapping resolution`,
    );
  }
});

test('Captain support ticket creation maps to notification/support, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/features/truthful-operational-ui.test.ts',
    'creates support ticket with backend acknowledgement and returns ticketId',
  );
  assert.ok(result.targetDuskyContractIds.includes('CAP-NOT-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-STATE-001'));
});

test('Captain support ticket error maps to notification, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/features/truthful-operational-ui.test.ts',
    'rejects ticket creation when server returns error and avoids false success',
  );
  assert.ok(result.targetDuskyContractIds.includes('CAP-NOT-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-STATE-001'));
});

test('Captain fingerprint tests map to representation/idempotency, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level1-unit/state-machines/command-state-machine.test.ts',
    'generates deterministic 32-bit FNV-1a payload fingerprints',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-REPR-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));

  const nested = classify(
    'apps/captain-app/src/__tests__/level1-unit/state-machines/command-state-machine.test.ts',
    'handles null, undefined, and complex nested payloads stably in fingerprinting',
  );
  assert.ok(
    nested.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      nested.targetDuskyContractIds.includes('BE-IDEMP-001') ||
      nested.targetDuskyContractIds.includes('BE-REPR-001'),
  );
  assert.ok(!nested.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Captain profile parsing maps to auth/profile, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/features/truthful-operational-ui.test.ts',
    'accurately parses active and approved captain profile',
  );
  assert.ok(result.targetDuskyContractIds.includes('CAP-AUTH-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CAP-STATE-001'));

  const draft = classify(
    'apps/captain-app/src/__tests__/features/truthful-operational-ui.test.ts',
    'accurately parses unapproved / draft profile without fake fallback objects',
  );
  assert.ok(draft.targetDuskyContractIds.includes('CAP-AUTH-001'));
  assert.ok(!draft.targetDuskyContractIds.includes('CAP-ASG-001'));
  assert.ok(!draft.targetDuskyContractIds.includes('CAP-STATE-001'));
});

test('Captain idempotency deduplication maps to idempotency, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level3-durable-commands/command-runner.test.ts',
    'deduplicates rapid double-tap requests on same resource into exactly ONE execution',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Captain idempotency key reuse maps to idempotency, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level3-durable-commands/command-runner.test.ts',
    'reuses the exact same idempotencyKey and commandId across 20 retries',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Captain fingerprint mismatch maps to idempotency, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level3-durable-commands/command-runner.test.ts',
    'rejects with IDEMPOTENCY_FINGERPRINT_MISMATCH when same active scope receives altered payload',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-REPR-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Captain concurrent operations maps to concurrency, not assignment/state', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level3-durable-commands/command-runner.test.ts',
    'proves concurrent operations on different offers execute independently without blocking',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-CON-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Captain different keys for different operations maps to idempotency/representation', () => {
  const result = classify(
    'apps/captain-app/src/__tests__/level3-durable-commands/command-runner.test.ts',
    'generates different keys for different operations on the same job',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CAP-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-IDEMP-001') ||
      result.targetDuskyContractIds.includes('BE-REPR-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CAP-ASG-001'));
});

test('Customer screen layout maps to accessibility, not discovery/search', () => {
  const result = classify(
    'apps/customer-app/src/__tests__/customer-screen-layout.test.ts',
    'category header is outside the padded content area',
  );
  assert.ok(result.targetDuskyContractIds.includes('CUS-A11Y-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('Touch-target tests map to accessibility, not discovery/search', () => {
  const result = classify(
    'apps/customer-app/src/__tests__/foundation-touch-target-contract.test.ts',
    'keeps shared filter chips and section actions on the canonical touch target',
  );
  assert.ok(result.targetDuskyContractIds.includes('CUS-A11Y-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('Foreign-document ownership rejection maps to authorization, not discovery/search', () => {
  const result = classify(
    'apps/customer-app/src/services/__tests__/critical-security-services.test.ts',
    'rejects foreign document listings with the server trace',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('BE-OBJ-001') ||
      result.targetDuskyContractIds.includes('CUS-PROF-001') ||
      result.targetDuskyContractIds.includes('BE-AUTH-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('Quote fields and server pricing maps to checkout/pricing, not discovery/search', () => {
  const result = classify(
    'apps/customer-app/src/services/__tests__/customer-quote-contract.test.ts',
    'sends only canonical outlet and listing-line fields and preserves server pricing',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CUS-CHK-001') ||
      result.targetDuskyContractIds.includes('CUS-PRICE-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('Malformed money in grooming services maps to pricing, not discovery/search', () => {
  const result = classify(
    'apps/customer-app/src/services/__tests__/p10-grooming-services.test.ts',
    'rejects cross-provider leakage and malformed money instead of inventing zero price',
  );
  assert.ok(
    result.targetDuskyContractIds.includes('CUS-CHK-001') ||
      result.targetDuskyContractIds.includes('CUS-PRICE-001'),
  );
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('Currency formatting in production-utilities maps to representation, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'formats currency values and rejects missing or non-finite inputs',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-REPR-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('Date/time formatting in production-utilities maps to representation, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'formats dates, date-times and times with invalid fallbacks',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-REPR-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('Distance/percentage formatting in production-utilities maps to representation, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'formats distance, percentages and generic status labels',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-REPR-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('Retry-After parsing in production-utilities maps to rate-limit/retry, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'parses Retry-After seconds, fractional seconds, dates and invalid values',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-RATE-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('API error-envelope parsing in production-utilities maps to validation/error, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'builds ApiError from JSON and plain-text HTTP responses',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-VALID-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('API status classification in production-utilities maps to validation/error, not CI policy', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities.test.ts',
    'classifies every API status family and preserves useful messages',
  );
  assert.ok(result.targetDuskyContractIds.includes('BE-VALID-001'));
  assert.ok(!result.targetDuskyContractIds.includes('FOUND-CI-001'));
});

test('production cannot accidentally match product in name patterns', () => {
  const result = classify(
    'apps/customer-app/src/__tests__/misc.test.ts',
    'production environment allows production traffic',
  );
  assert.ok(!result.targetDuskyContractIds.includes('CUS-PROV-001'));
  assert.ok(!result.targetDuskyContractIds.includes('CUS-SEARCH-001'));
});

test('exact-file overrides do not affect a similar neighboring path', () => {
  const result = classify(
    'apps/customer-app/src/utils/__tests__/production-utilities-extra.test.ts',
    'formats currency values and rejects missing or non-finite inputs',
  );
  assert.ok(result.mappingRuleId !== 'CUS-UTILITIES-CURRENCY');
});

test('resolved incompatible overlap requires documented reason', () => {
  assert.throws(
    () =>
      classify(
        'apps/customer-app/src/__tests__/misc.test.ts',
        'checkout payment and reward recovery',
      ),
    /incompatible/i,
  );
});
