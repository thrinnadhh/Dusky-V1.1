import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateRegistryData } from './validate-contracts.mjs';
import { validateRepository } from './validate-repository.mjs';
import { validateTestIntegrity } from './validate-test-integrity.mjs';

const root = new URL('..', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const catalogs = ['customer', 'merchant', 'captain', 'admin', 'backend', 'e2e'].map((name) =>
  json(`contracts/scenarios/${name}.json`),
);
const input = () => ({
  root,
  registry: structuredClone(json('contracts/registry/contracts.json')),
  schema: json('contracts/registry/contract.schema.json'),
  activeBaseline: json('contracts/registry/active-baseline.json'),
  exceptions: json('contracts/registry/breaking-change-exceptions.json'),
  scenarioCatalogs: structuredClone(catalogs),
});
const expectGate = (name, expression, pattern) => {
  assert.throws(expression, pattern);
  console.log(`PASS: ${name} was rejected.`);
};

const duplicate = input();
duplicate.registry.contracts.push(structuredClone(duplicate.registry.contracts[0]));
expectGate(
  'duplicate contract ID',
  () => validateRegistryData(duplicate),
  /Duplicate contract IDs/,
);

const missingScenario = input();
missingScenario.scenarioCatalogs = [];
expectGate(
  'planned contract without scenario',
  () => validateRegistryData(missingScenario),
  /Planned contract without scenario/,
);

const noTests = input();
noTests.registry.contracts.find(({ status }) => status === 'active').executableTestPaths = [];
expectGate(
  'active contract without tests',
  () => validateRegistryData(noTests),
  /Active contract without tests/,
);

const downgrade = input();
downgrade.registry.contracts.find(({ contractId }) => contractId === 'FOUND-APP-CUS-001').status =
  'planned';
expectGate(
  'active-to-planned downgrade',
  () => validateRegistryData(downgrade),
  /Active-to-planned downgrade/,
);

const provenance = input();
provenance.registry.contracts.find(
  ({ status }) => status === 'planned',
).legacyProvenance[0].sourcePath = 'missing/evidence.json';
expectGate(
  'broken legacy provenance',
  () => validateRegistryData(provenance),
  /Broken provenance path/,
);

const integrityRoot = mkdtempSync(join(tmpdir(), 'dusky-adversarial-integrity-'));
for (const app of ['customer-app', 'merchant-app', 'captain-app', 'admin-web']) {
  mkdirSync(join(integrityRoot, 'apps', app), { recursive: true });
  writeFileSync(
    join(integrityRoot, 'apps', app, 'package.json'),
    JSON.stringify({ scripts: { test: 'test' } }),
  );
}
mkdirSync(join(integrityRoot, 'backend/src/test'), { recursive: true });
mkdirSync(join(integrityRoot, 'src'), { recursive: true });
writeFileSync(
  join(integrityRoot, 'src/disabled.test.ts'),
  `${['test', 'skip'].join('.')}('disabled', () => {});`,
);
expectGate('skipped/focused test', () => validateTestIntegrity(integrityRoot), /skipped test/);

const repositoryRoot = mkdtempSync(join(tmpdir(), 'dusky-adversarial-repository-'));
for (const path of [
  'apps/customer-app',
  'apps/merchant-app',
  'apps/admin-web',
  'backend',
  'packages/contracts',
  'packages/test-kit',
  'contracts/registry',
  'contracts/scenarios',
  'contracts/legacy',
  'docs',
  'scripts',
  '.github/workflows',
])
  mkdirSync(join(repositoryRoot, path), { recursive: true });
writeFileSync(join(repositoryRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 6');
writeFileSync(join(repositoryRoot, 'gradlew'), 'placeholder');
expectGate(
  'missing required application',
  () => validateRepository(repositoryRoot),
  /apps\/captain-app/,
);

const failingRoot = mkdtempSync(join(tmpdir(), 'dusky-adversarial-failing-'));
const failingPath = join(failingRoot, 'failing.test.mjs');
writeFileSync(
  failingPath,
  "import test from 'node:test'; import assert from 'node:assert/strict'; test('fails', () => assert.equal(1, 2));",
);
const failing = spawnSync(process.execPath, ['--test', failingPath], { encoding: 'utf8' });
assert.notEqual(failing.status, 0);
console.log('PASS: failing executable test propagated a non-zero exit code.');

console.log('All adversarial P0 gates behaved as required.');
