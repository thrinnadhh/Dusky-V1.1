import assert from 'node:assert/strict';
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
  const result = classify(
    'apps/customer-app/src/__tests__/misc.test.ts',
    'checkout payment and reward recovery',
  );
  assert.equal(result.mappingRuleId, 'MANUAL-REVIEW-AMBIGUOUS');
  assert.equal(result.disposition, 'requires-business-decision');
  assert.deepEqual(result.targetDuskyContractIds, []);
  assert.match(result.mappingResolutionReason, /incompatible.*CUS-PAYMENT.*CUS-CHECKOUT-PRICE/i);
});

test('records an auditable resolution reason for every automatic mapping', () => {
  const result = classify(
    'apps/customer-app/src/context/__tests__/FavouritesContext.behavior.test.tsx',
    'migrates guest products to the server',
  );
  assert.match(result.mappingResolutionReason, /priority|specific|override/i);
});
