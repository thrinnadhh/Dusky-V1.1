import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function validateRegistryData({
  root,
  registry,
  schema,
  activeBaseline,
  exceptions,
  scenarioCatalogs,
}) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(registry))
    throw new Error(
      `Contract schema failed: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
    );
  const ids = registry.contracts.map(({ contractId }) => contractId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate contract IDs are forbidden.');
  const scenariosByContract = new Map();
  for (const catalog of scenarioCatalogs) {
    for (const scenario of catalog.scenarios) {
      for (const id of scenario.contractIds) {
        if (!ids.includes(id))
          throw new Error(`Scenario ${scenario.scenarioId} references missing contract ${id}.`);
        scenariosByContract.set(id, (scenariosByContract.get(id) ?? 0) + 1);
      }
    }
  }
  for (const activeId of activeBaseline.activeContractIds) {
    const current = registry.contracts.find(({ contractId }) => contractId === activeId);
    if (!current) throw new Error(`Silent deletion of active contract: ${activeId}`);
    if (current.status !== 'active')
      throw new Error(`Active-to-planned downgrade forbidden: ${activeId}`);
  }
  for (const contract of registry.contracts) {
    if (!contract.producer || !contract.consumers.length)
      throw new Error(`${contract.contractId} is missing producer/consumers.`);
    if (contract.status === 'planned' && !scenariosByContract.has(contract.contractId))
      throw new Error(`Planned contract without scenario: ${contract.contractId}`);
    if (contract.status === 'active') {
      if (!contract.executableTestPaths.length)
        throw new Error(`Active contract without tests: ${contract.contractId}`);
      for (const path of contract.executableTestPaths)
        if (!existsSync(join(root, path)))
          throw new Error(`Active test path missing for ${contract.contractId}: ${path}`);
    }
    for (const provenance of contract.legacyProvenance) {
      if (!provenance.sourcePath || !provenance.sourceSha)
        throw new Error(`Broken provenance for ${contract.contractId}`);
      if (!existsSync(join(root, provenance.sourcePath)))
        throw new Error(
          `Broken provenance path for ${contract.contractId}: ${provenance.sourcePath}`,
        );
    }
    if (contract.criticality === 'launch-critical') {
      const criteria = [
        'preconditions',
        'successBehavior',
        'errorBehavior',
        'authorization',
        'tenantOutletIsolation',
        'idempotency',
        'concurrency',
        'offlineRetryBehavior',
      ];
      for (const key of criteria)
        if (!contract[key]?.length)
          throw new Error(`Launch-critical contract lacks ${key}: ${contract.contractId}`);
    }
  }
  const now = Date.now();
  for (const exception of exceptions.exceptions) {
    if (Date.parse(exception.expiresAt) <= now)
      throw new Error(`Expired breaking-change exception: ${exception.id}`);
  }
  return {
    contractCount: ids.length,
    activeCount: registry.contracts.filter(({ status }) => status === 'active').length,
    plannedCount: registry.contracts.filter(({ status }) => status === 'planned').length,
  };
}

export function validateContracts(root = DEFAULT_ROOT) {
  const registryDir = join(root, 'contracts/registry');
  const scenarioDir = join(root, 'contracts/scenarios');
  const scenarioCatalogs = readdirSync(scenarioDir)
    .filter((name) => name.endsWith('.json') && name !== 'scenario.schema.json')
    .map((name) => readJson(join(scenarioDir, name)));
  return validateRegistryData({
    root,
    registry: readJson(join(registryDir, 'contracts.json')),
    schema: readJson(join(registryDir, 'contract.schema.json')),
    activeBaseline: readJson(join(registryDir, 'active-baseline.json')),
    exceptions: readJson(join(registryDir, 'breaking-change-exceptions.json')),
    scenarioCatalogs,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateContracts(resolve(option('--root') ?? DEFAULT_ROOT));
  console.log(
    `Contract registry valid: ${result.contractCount} total, ${result.activeCount} active, ${result.plannedCount} planned.`,
  );
}
