import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const VALID_DISPOSITIONS = new Set([
  'mapped',
  'duplicate',
  'obsolete-with-evidence',
  'implementation-specific-rewritten',
  'requires-business-decision',
]);
const VALID_DECISIONS = new Set(
  Array.from({ length: 10 }, (_, index) => `BD-${String(index + 1).padStart(3, '0')}`),
);

const assertNormalizedPath = (path, label) => {
  if (isAbsolute(path) || /^[A-Za-z]:[\\/]/.test(path))
    throw new Error(`Absolute workstation path in ${label}: ${path}`);
  if (!path || path.split(/[\\/]/).includes('..'))
    throw new Error(`Invalid normalized path in ${label}: ${path}`);
};

const manifestFiles = (manifest) => [
  ...(manifest.publicEvidence?.files ?? []),
  ...(Array.isArray(manifest.localEvidence)
    ? manifest.localEvidence
    : (manifest.localEvidence?.files ?? [])),
];

export function validateReciprocalProvenance({ contracts, inventory, manifest }) {
  const contractsById = new Map(contracts.map((contract) => [contract.contractId, contract]));
  const inventoryById = new Map(inventory.tests.map((entry) => [entry.legacyTestId, entry]));
  if (inventoryById.size !== inventory.tests.length)
    throw new Error('Duplicate legacy test IDs prevent reciprocal provenance.');
  const evidenceFiles = manifestFiles(manifest);
  const reciprocalIds = new Set();

  for (const file of manifestFiles(manifest)) assertNormalizedPath(file.path, 'source manifest');
  for (const entry of inventory.tests) {
    assertNormalizedPath(entry.sourcePath, 'legacy evidence');
    if (
      !VALID_DISPOSITIONS.has(entry.disposition) ||
      !entry.dispositionEvidence ||
      !entry.mappingRuleId ||
      !entry.mappingResolutionReason
    )
      throw new Error(`Legacy disposition lacks evidence: ${entry.legacyTestId}`);
    const evidence = evidenceFiles.find(
      (file) => file.path === entry.sourcePath && file.sha256 === entry.sourceFileSha256,
    );
    if (!evidence)
      throw new Error(`Manifest hash evidence is missing or mismatched: ${entry.legacyTestId}`);
    if (
      entry.evidenceScope === 'pinned-public-ci-verifiable' &&
      (entry.sourceRepository !== 'Mypetnew' || entry.sourceSha !== manifest.sourceSha)
    )
      throw new Error(`Pinned public source identity mismatch for ${entry.legacyTestId}`);
    if (
      entry.evidenceScope === 'local-uncommitted-hash-only' &&
      (entry.sourceRepository !== 'Mypetnew-local-uncommitted' ||
        entry.sourceSha !== `uncommitted@${manifest.sourceSha}`)
    )
      throw new Error(`Local-only source identity mismatch for ${entry.legacyTestId}`);
    if (
      !['pinned-public-ci-verifiable', 'local-uncommitted-hash-only'].includes(entry.evidenceScope)
    )
      throw new Error(`Unknown evidence scope for ${entry.legacyTestId}`);
    const decisionRefs = entry.businessDecisionRefs ?? [];
    if (decisionRefs.some((decision) => !VALID_DECISIONS.has(decision)))
      throw new Error(`Invalid business decision reference for ${entry.legacyTestId}`);
    if (entry.disposition === 'requires-business-decision' && decisionRefs.length === 0)
      throw new Error(`Decision disposition lacks a decision reference: ${entry.legacyTestId}`);
  }

  for (const contract of contracts) {
    if (
      contract.legacyProvenance?.some(({ sourcePath }) =>
        /MYPETNEW_TEST_INVENTORY\.json$/i.test(sourcePath ?? ''),
      )
    )
      throw new Error(`Contract ${contract.contractId} points only to a generic inventory file.`);
    const provenance = contract.provenance;
    if (!provenance)
      throw new Error(`Contract ${contract.contractId} has no machine-readable provenance.`);
    const legacyIds = provenance.legacyTestIds ?? [];
    if (!legacyIds.length && !(provenance.greenfieldRationale?.length >= 20))
      throw new Error(
        `Contract ${contract.contractId} needs exact legacy IDs or a greenfield rationale.`,
      );
    for (const legacyId of legacyIds) {
      const entry = inventoryById.get(legacyId);
      if (!entry)
        throw new Error(
          `Contract ${contract.contractId} references missing legacy test ID ${legacyId}.`,
        );
      if (!entry.targetDuskyContractIds?.includes(contract.contractId))
        throw new Error(`Legacy test ${legacyId} does not map back to ${contract.contractId}.`);
      reciprocalIds.add(legacyId);
    }
    for (const decision of contract.businessDecisionRefs ?? [])
      if (!VALID_DECISIONS.has(decision))
        throw new Error(`Contract ${contract.contractId} has invalid decision ${decision}.`);
  }

  for (const entry of inventory.tests) {
    for (const contractId of entry.targetDuskyContractIds ?? []) {
      const contract = contractsById.get(contractId);
      if (!contract) throw new Error(`Legacy mapping references missing contract ${contractId}.`);
      if (!contract.provenance?.legacyTestIds?.includes(entry.legacyTestId))
        throw new Error(
          `Inventory ${entry.legacyTestId} has missing reciprocal contract reference ${contractId}.`,
        );
    }
  }
  return { reciprocalLegacyIdCount: reciprocalIds.size };
}

const semverParts = (version) => version.split('.').map((part) => Number.parseInt(part, 10));
const compareSemver = (left, right) => {
  const a = semverParts(left);
  const b = semverParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

const ACTIVE_METADATA_ALLOWLIST = new Set(['version']);

const changedActiveSemanticFields = (base, current) =>
  [...new Set([...Object.keys(base), ...Object.keys(current)])]
    .filter((field) => !ACTIVE_METADATA_ALLOWLIST.has(field))
    .filter((field) => JSON.stringify(current[field]) !== JSON.stringify(base[field]))
    .sort();

function validatedExceptions(exceptions, now) {
  const byContractAndType = new Map();
  for (const exception of exceptions.exceptions ?? []) {
    const requiredStrings = [
      'id',
      'contractId',
      'changeType',
      'reason',
      'owner',
      'expiresAt',
      'userAuthorizationReference',
    ];
    const migrationPlan = exception.replacementOrMigrationPlan ?? exception.migrationPlan;
    if (
      requiredStrings.some(
        (field) => typeof exception[field] !== 'string' || exception[field].trim().length < 3,
      ) ||
      exception.contractId === '*' ||
      !['deletion', 'downgrade', 'version-regression', 'semantic-change'].includes(
        exception.changeType,
      ) ||
      typeof migrationPlan !== 'string' ||
      migrationPlan.trim().length < 10 ||
      !/^USER-AUTH-[A-Z0-9][A-Z0-9-]{7,}$/i.test(exception.userAuthorizationReference) ||
      Number.isNaN(Date.parse(exception.expiresAt))
    )
      throw new Error(
        `Malformed or blanket breaking-change exception: ${exception.id ?? 'unknown'}`,
      );
    if (Date.parse(exception.expiresAt) <= now.getTime())
      throw new Error(`Expired breaking-change exception: ${exception.id}`);
    const key = `${exception.contractId}:${exception.changeType}`;
    if (byContractAndType.has(key))
      throw new Error(`Duplicate breaking-change exception scope: ${key}`);
    byContractAndType.set(key, exception);
  }
  return byContractAndType;
}

export function validateActiveContractProtection({
  baseRegistry,
  currentRegistry,
  exceptions,
  now = new Date(),
}) {
  const approved = validatedExceptions(exceptions, now);
  const currentById = new Map(
    currentRegistry.contracts.map((contract) => [contract.contractId, contract]),
  );
  let protectedCount = 0;
  const allowed = (contractId, type) => approved.has(`${contractId}:${type}`);
  for (const base of baseRegistry.contracts.filter(({ status }) => status === 'active')) {
    const current = currentById.get(base.contractId);
    if (!current) {
      if (!allowed(base.contractId, 'deletion'))
        throw new Error(`Base-active contract was deleted: ${base.contractId}`);
      continue;
    }
    if (current.status !== 'active' && !allowed(base.contractId, 'downgrade'))
      throw new Error(`Base-active contract was downgraded: ${base.contractId}`);
    if (
      compareSemver(current.version, base.version) < 0 &&
      !allowed(base.contractId, 'version-regression')
    )
      throw new Error(`Active contract version regression: ${base.contractId}`);
    const changedSemantics = changedActiveSemanticFields(base, current);
    if (changedSemantics.length && !allowed(base.contractId, 'semantic-change'))
      throw new Error(
        `Unapproved active semantic change for ${base.contractId}: ${changedSemantics.join(', ')}`,
      );
    protectedCount += 1;
  }
  return { protectedActiveCount: protectedCount };
}

export function loadBaseRegistry(root, baseSha) {
  if (!/^[a-f0-9]{40}$/i.test(baseSha ?? ''))
    throw new Error(`Base SHA must be an exact 40-character commit ID: ${baseSha ?? 'missing'}`);
  const commit = spawnSync('git', ['-C', root, 'cat-file', '-e', `${baseSha}^{commit}`], {
    encoding: 'utf8',
  });
  if (commit.status !== 0) throw new Error(`Base SHA is not available locally: ${baseSha}`);
  const object = `${baseSha}:contracts/registry/contracts.json`;
  const exists = spawnSync('git', ['-C', root, 'cat-file', '-e', object], { encoding: 'utf8' });
  if (exists.status !== 0) return { schemaVersion: 'base-without-registry', contracts: [] };
  const shown = spawnSync('git', ['-C', root, 'show', object], { encoding: 'utf8' });
  if (shown.status !== 0)
    throw new Error(`Unable to load base contract registry at ${baseSha}: ${shown.stderr.trim()}`);
  try {
    return JSON.parse(shown.stdout);
  } catch (error) {
    throw new Error(`Base contract registry is invalid JSON at ${baseSha}: ${error.message}`);
  }
}

export function validateRegistryData({
  root,
  registry,
  schema,
  activeBaseline,
  exceptions,
  scenarioCatalogs,
  inventory = readJson(join(root, 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json')),
  manifest = readJson(join(root, 'contracts/legacy/MYPETNEW_SOURCE_MANIFEST.json')),
  baseRegistry,
  now = new Date(),
}) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(registry))
    throw new Error(
      `Contract schema failed: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
    );
  validatedExceptions(exceptions, now);
  const decisionDocument = readFileSync(
    join(root, 'docs/p0/P0_OPEN_BUSINESS_DECISIONS.md'),
    'utf8',
  );
  for (const decision of VALID_DECISIONS)
    if (!decisionDocument.includes(decision))
      throw new Error(`Open business decision document is missing ${decision}.`);
  const ids = registry.contracts.map(({ contractId }) => contractId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate contract IDs are forbidden.');
  const scenariosByContract = new Map();
  const scenarioIds = new Set();
  for (const catalog of scenarioCatalogs) {
    for (const scenario of catalog.scenarios) {
      if (scenarioIds.has(scenario.scenarioId))
        throw new Error(`Duplicate scenario ID: ${scenario.scenarioId}`);
      scenarioIds.add(scenario.scenarioId);
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
      for (const path of contract.executableTestPaths) {
        assertNormalizedPath(path, `active evidence for ${contract.contractId}`);
        if (!existsSync(join(root, path)))
          throw new Error(`Active test path missing for ${contract.contractId}: ${path}`);
      }
    }
    if (contract.criticality === 'launch-critical') {
      for (const key of [
        'actors',
        'preconditions',
        'successBehavior',
        'errorBehavior',
        'stateTransitions',
        'databaseInvariants',
        'interactions',
        'errorCodes',
        'authorization',
        'applicability',
        'testExpectations',
        'activationEvidence',
      ])
        if (!contract[key] || (Array.isArray(contract[key]) && !contract[key].length))
          throw new Error(`Launch-critical contract lacks ${key}: ${contract.contractId}`);
    }
  }

  const reciprocal = validateReciprocalProvenance({
    contracts: registry.contracts,
    inventory,
    manifest,
  });
  const baseProtection = baseRegistry
    ? validateActiveContractProtection({
        baseRegistry,
        currentRegistry: registry,
        exceptions,
        now,
      })
    : { protectedActiveCount: 0 };
  return {
    contractCount: ids.length,
    activeCount: registry.contracts.filter(({ status }) => status === 'active').length,
    plannedCount: registry.contracts.filter(({ status }) => status === 'planned').length,
    reciprocalLegacyIdCount: reciprocal.reciprocalLegacyIdCount,
    protectedActiveCount: baseProtection.protectedActiveCount,
  };
}

export function validateContracts(root = DEFAULT_ROOT, { baseSha } = {}) {
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
    baseRegistry: baseSha ? loadBaseRegistry(root, baseSha) : undefined,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateContracts(resolve(option('--root') ?? DEFAULT_ROOT), {
    baseSha: option('--base-sha'),
  });
  console.log(
    `Contract registry valid: ${result.contractCount} total, ${result.activeCount} active, ${result.plannedCount} planned, ${result.reciprocalLegacyIdCount} reciprocal legacy IDs, ${result.protectedActiveCount} base-active protected.`,
  );
}
