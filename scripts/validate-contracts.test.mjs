import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { validateContracts, validateRegistryData } from './validate-contracts.mjs';
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
