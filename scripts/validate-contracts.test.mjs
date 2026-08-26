import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  validateActiveContractProtection,
  validateContracts,
  validateRegistryData,
} from './validate-contracts.mjs';
import { validateScenarios } from './validate-scenarios.mjs';

const root = new URL('..', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const baseInput = () => ({
  root,
  registry: structuredClone(json('contracts/registry/contracts.json')),
  schema: json('contracts/registry/contract.schema.json'),
  activeBaseline: json('contracts/registry/active-baseline.json'),
  exceptions: json('contracts/registry/breaking-change-exceptions.json'),
  scenarioCatalogs: readdirSync(join(root, 'contracts/scenarios'))
    .filter((name) => name.endsWith('.json') && name !== 'scenario.schema.json')
    .map((name) => json(`contracts/scenarios/${name}`)),
});

test('committed contract registry is valid', () =>
  assert.equal(validateContracts(root).contractCount, 110));

test('committed registry can be compared with the actual bootstrap base SHA', () => {
  const result = validateContracts(root, {
    baseSha: 'de300e3da2fafb5a50328769b8feaa6fe69b3850',
  });
  assert.equal(result.protectedActiveCount, 0);
  assert.equal(result.reciprocalLegacyIdCount, 1163);
});

test('committed scenario catalogs satisfy their schema', () =>
  assert.equal(validateScenarios(root).scenarioCount, 99));

test('duplicate IDs and planned contracts without scenarios are rejected', () => {
  const duplicate = baseInput();
  duplicate.registry.contracts.push(structuredClone(duplicate.registry.contracts[0]));
  assert.throws(() => validateRegistryData(duplicate), /Duplicate contract IDs/);
  const missingScenario = baseInput();
  missingScenario.scenarioCatalogs = [];
  assert.throws(() => validateRegistryData(missingScenario), /Planned contract without scenario/);
});

test('active downgrade and missing executable evidence are rejected', () => {
  const downgrade = baseInput();
  downgrade.registry.contracts.find(({ contractId }) => contractId === 'FOUND-APP-CUS-001').status =
    'planned';
  assert.throws(() => validateRegistryData(downgrade), /Active-to-planned downgrade/);
  const missing = baseInput();
  missing.registry.contracts.find(({ status }) => status === 'active').executableTestPaths = [];
  assert.throws(() => validateRegistryData(missing), /Active contract without tests/);
});

test('base-aware protection rejects every reviewed active semantic mutation', () => {
  const base = structuredClone(
    baseInput().registry.contracts.find(({ contractId }) => contractId === 'FOUND-CI-001'),
  );
  const mutations = [
    ['domain', (contract) => (contract.domain = 'Backend')],
    ['criticality', (contract) => (contract.criticality = 'high')],
    ['businessDecisionRefs', (contract) => contract.businessDecisionRefs.push('BD-001')],
    [
      'provenance',
      (contract) =>
        (contract.provenance = {
          legacyTestIds: [],
          greenfieldRationale: 'Changed provenance must require explicit user authorization.',
        }),
    ],
    [
      'plannedImplementationWorkstream',
      (contract) => (contract.plannedImplementationWorkstream = 'unreviewed-workstream'),
    ],
  ];

  for (const [field, mutate] of mutations) {
    const current = structuredClone(base);
    mutate(current);
    assert.throws(
      () =>
        validateActiveContractProtection({
          baseRegistry: { contracts: [base] },
          currentRegistry: { contracts: [current] },
          exceptions: { exceptions: [] },
        }),
      new RegExp(`semantic change.*${field}|${field}.*semantic change`, 'i'),
      `${field} changed without an exception`,
    );
  }
});

test('base-aware protection compares newly introduced active semantic fields by default', () => {
  const base = structuredClone(
    baseInput().registry.contracts.find(({ contractId }) => contractId === 'FOUND-CI-001'),
  );
  base.securityExpectation = 'Reject execution outside the checked-out repository.';
  const current = structuredClone(base);
  current.securityExpectation = 'Allow execution from any directory.';
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: { contracts: [base] },
        currentRegistry: { contracts: [current] },
        exceptions: { exceptions: [] },
      }),
    /semantic change.*securityExpectation|securityExpectation.*semantic change/i,
  );
});

test('semantic exception must be exact, unexpired, user-authorized, and migration-backed', () => {
  const base = structuredClone(
    baseInput().registry.contracts.find(({ contractId }) => contractId === 'FOUND-CI-001'),
  );
  const current = structuredClone(base);
  current.domain = 'Backend';
  const validException = {
    id: 'EXC-FOUND-CI-DOMAIN-001',
    contractId: 'FOUND-CI-001',
    changeType: 'semantic-change',
    reason: 'Reviewed domain ownership migration for this exact active contract.',
    owner: 'repository maintainer',
    replacementOrMigrationPlan:
      'Move executable evidence and downstream ownership before changing the registry.',
    expiresAt: '2099-01-01T00:00:00Z',
    userAuthorizationReference: 'USER-AUTH-REVIEW-0001',
  };
  assert.equal(
    validateActiveContractProtection({
      baseRegistry: { contracts: [base] },
      currentRegistry: { contracts: [current] },
      exceptions: { exceptions: [validException] },
      now: new Date('2026-08-26T00:00:00Z'),
    }).protectedActiveCount,
    1,
  );

  const malformed = structuredClone(validException);
  malformed.userAuthorizationReference = 'review-comment';
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: { contracts: [base] },
        currentRegistry: { contracts: [current] },
        exceptions: { exceptions: [malformed] },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /malformed.*exception/i,
  );
});
