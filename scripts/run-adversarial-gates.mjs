import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { validateActiveContractProtection, validateRegistryData } from './validate-contracts.mjs';
import { validateRepository } from './validate-repository.mjs';

const root = new URL('..', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const catalogs = ['customer', 'merchant', 'captain', 'admin', 'backend', 'e2e'].map((name) =>
  json(`contracts/scenarios/${name}.json`),
);
const input = () => ({
  root,
  registry: structuredClone(json('contracts/registry/contracts.json')),
  schema: json('contracts/registry/contract.schema.json'),
  activeBaseline: structuredClone(json('contracts/registry/active-baseline.json')),
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
  'editable baseline active-to-planned downgrade',
  () => validateRegistryData(downgrade),
  /Active-to-planned downgrade/,
);

const missingExactProvenance = input();
missingExactProvenance.registry.contracts.find(
  ({ status }) => status === 'planned',
).provenance.legacyTestIds = ['LEG-FFFFFFFFFFFF'];
expectGate(
  'missing exact legacy provenance ID',
  () => validateRegistryData(missingExactProvenance),
  /missing legacy test ID/,
);

const baseAwareWeakening = input();
const protectedContract = baseAwareWeakening.registry.contracts.find(
  ({ contractId }) => contractId === 'FOUND-CI-001',
);
const baseRegistry = { contracts: [structuredClone(protectedContract)] };
baseAwareWeakening.registry.contracts.find(
  ({ contractId }) => contractId === 'FOUND-CI-001',
).errorBehavior = ['A failed quality gate may be ignored.'];
baseAwareWeakening.activeBaseline.activeContractIds =
  baseAwareWeakening.activeBaseline.activeContractIds.filter(
    (contractId) => contractId !== 'FOUND-CI-001',
  );
baseAwareWeakening.baseRegistry = baseRegistry;
expectGate(
  'base-active weakening hidden by edited baseline',
  () => validateRegistryData(baseAwareWeakening),
  /silent weakening|semantic change/i,
);

const weakened = { contracts: [structuredClone(protectedContract)] };
weakened.contracts[0].errorBehavior = ['Failures may be ignored.'];
expectGate(
  'base-active semantic weakening',
  () =>
    validateActiveContractProtection({
      baseRegistry,
      currentRegistry: weakened,
      exceptions: { exceptions: [] },
    }),
  /silent weakening|semantic change/i,
);

const adversarialSuites = [
  'scripts/contract-catalog-quality.test.mjs',
  'scripts/validate-semantic-contracts.test.mjs',
  'scripts/legacy-mapping.test.mjs',
  'scripts/validate-provenance.test.mjs',
  'scripts/validate-contracts.test.mjs',
  'scripts/validate-repository.test.mjs',
  'scripts/validate-test-integrity.test.mjs',
];
const adversarial = spawnSync(process.execPath, ['--test', ...adversarialSuites], {
  cwd: root,
  encoding: 'utf8',
});
if (adversarial.status !== 0)
  throw new Error(
    `Adversarial regression suite failed:\n${adversarial.stdout}\n${adversarial.stderr}`,
  );
console.log(
  'PASS: semantic, mapping, reciprocal provenance, focused/disabled/todo, JUnit, empty-suite, placeholder, and suppressed-exit adversarial fixtures passed.',
);

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
