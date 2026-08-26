import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyLegacyEvidence, normalizeSourcePath } from './legacy-mapping.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_REPOSITORY = 'https://github.com/thrinnadhh/Mypetnew.git';
const SOURCE_SHA = '817c6487cdbf18fc282dc0a44538d83e7bc5ef8b';
const LOCAL_SOURCE_SHA = `uncommitted@${SOURCE_SHA}`;
const SCRIPT_VERSION = '2.1.0';
const DISPOSITIONS = [
  'mapped',
  'duplicate',
  'obsolete-with-evidence',
  'implementation-specific-rewritten',
  'requires-business-decision',
];
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const checking = args.includes('--check');
const sourceRoot = option('--source') ?? process.env.MYPETNEW_PATH;
const preservedRoot = option('--preserved-root') ?? process.env.MYPETNEW_PRESERVED_PATH;
const inventoryPath = join(ROOT, 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json');
const manifestPath = join(ROOT, 'contracts/legacy/MYPETNEW_SOURCE_MANIFEST.json');

const preservedRegressionPaths = [
  'apps/customer-app/src/__tests__/customer-journey-contracts.test.ts',
  'apps/customer-app/src/__tests__/food-filter-tags.test.ts',
  'apps/customer-app/src/__tests__/p5-product-detail-cart-contract.test.ts',
  'apps/customer-app/src/__tests__/s12-commerce.test.ts',
  'apps/customer-app/src/services/__tests__/paginated-catalog.test.ts',
];
const additionalLocalEvidencePaths = [
  'apps/customer-app/src/demo/__tests__/customer-data.test.ts',
  'apps/customer-app/src/__tests__/demo-isolation-architecture.test.ts',
  'apps/customer-app/src/services/__tests__/backend-capabilities.test.ts',
];
const allLocalEvidencePaths = [...preservedRegressionPaths, ...additionalLocalEvidencePaths];

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const stableId = (prefix, value) =>
  `${prefix}-${createHash('sha1').update(value).digest('hex').slice(0, 12).toUpperCase()}`;
const git = (cwd, gitArgs) => {
  const result = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${gitArgs.join(' ')} failed`);
  return result.stdout.trim();
};
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function isTestKnowledgeFile(path) {
  if (
    /\.(?:js|jsx|mjs|cjs|ts|tsx)$/i.test(path) &&
    (path.includes('/__tests__/') || /\.(?:test|spec)\./i.test(path))
  )
    return true;
  if (/backend\/src\/test\/.+\.kt$/i.test(path)) return true;
  if (
    /^scripts\/.+\.(?:sh|mjs)$/i.test(path) &&
    /(?:test|verify|validate|preflight|evidence)/i.test(basename(path))
  )
    return true;
  if (/^apps\/.+\/(?:test|verify|validate)[^/]*\.sh$/i.test(path)) return true;
  if (/^\.github\/workflows\/.+\.ya?ml$/i.test(path)) return true;
  return false;
}

function casesFrom(path, content) {
  const cases = [];
  let suite = basename(path);
  const suiteMatch =
    content.match(/(?:describe|context|suite)\s*\(\s*['"`]([^'"`]+)/) ??
    content.match(/class\s+(\w+(?:Test|Spec))/);
  if (suiteMatch?.[1]) suite = suiteMatch[1];
  if (/\.kt$/i.test(path)) {
    const annotated = /@Test[\s\S]{0,500}?fun\s+(?:`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*))\s*\(/g;
    for (const match of content.matchAll(annotated))
      cases.push({ suite, name: match[1] ?? match[2], kind: 'JUnit/Kotlin test' });
  } else if (/\.ya?ml$/i.test(path)) {
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*-?\s*(?:name|run):\s*[|>]?[ ]*(.+)$/i);
      if (match && /(?:test|verify|validate|check|gradle|npm|pnpm|install|lint)/i.test(match[1]))
        cases.push({ suite, name: `CI: ${match[1].trim()}`, kind: 'CI-only test command' });
    }
  } else if (/\.sh$/i.test(path)) {
    for (const line of content.split('\n')) {
      const command = line.trim();
      if (
        command &&
        !command.startsWith('#') &&
        /(?:test|verify|validate|check|gradle|npm|pnpm|install|lint)/i.test(command)
      )
        cases.push({ suite, name: `Shell: ${command.slice(0, 180)}`, kind: 'shell validation' });
    }
  } else {
    const testPattern =
      /\b(it|test)(?:\.(?:each|concurrent))?(?:<[^>]+>)?(?:\([^)]*\))?\s*\(\s*['"`]([^'"`]+)['"`]/g;
    for (const match of content.matchAll(testPattern))
      cases.push({
        suite,
        name: match[2].replace(/\s+/g, ' ').trim(),
        kind: 'TypeScript/JavaScript test',
      });
  }
  return cases.length
    ? cases
    : [
        {
          suite,
          name: `File-level validation entrypoint: ${basename(path)}`,
          kind: 'file-level test knowledge',
        },
      ];
}

function classifications(text) {
  const result = [];
  if (/(reject|invalid|error|fail|denied|missing|expired|stale|cancel)/i.test(text))
    result.push('failure');
  if (/(auth|security|tenant|outlet|forbid|privacy|permission)/i.test(text))
    result.push('security');
  if (/(concurr|race|duplicate|idempot|replay|multi-device)/i.test(text))
    result.push('concurrency');
  if (!result.length || /(success|returns|creates|renders|allows|persists)/i.test(text))
    result.push('success');
  return [...new Set(result)];
}

function inventoryEntries({ repository, sourceSha, path, content, fileHash }) {
  const normalizedPath = normalizeSourcePath(path);
  return casesFrom(normalizedPath, content).map(({ suite, name, kind }, index) => {
    const mapping = classifyLegacyEvidence({
      sourcePath: normalizedPath,
      originalTestName: name,
      testCategory: kind,
    });
    return {
      legacyTestId: stableId(
        repository === 'Mypetnew' ? 'LEG' : 'LOCAL',
        `${normalizedPath}\0${name}\0${index}`,
      ),
      sourceRepository: repository,
      sourceSha,
      sourcePath: normalizedPath,
      sourceFileSha256: fileHash,
      evidenceScope:
        repository === 'Mypetnew' ? 'pinned-public-ci-verifiable' : 'local-uncommitted-hash-only',
      sourceModule: mapping.sourceModule,
      suiteClassName: suite,
      originalTestName: name,
      testCategory: kind,
      behavior: name,
      classifications: classifications(`${normalizedPath} ${name}`),
      launchCriticality:
        /(auth|checkout|payment|order|inventory|delivery|tenant|outlet|concurr|migration)/i.test(
          `${normalizedPath} ${name}`,
        )
          ? 'launch-critical'
          : 'useful',
      targetDuskyContractIds: mapping.targetDuskyContractIds,
      disposition: mapping.disposition,
      mappingRuleId: mapping.mappingRuleId,
      mappingResolutionReason: mapping.mappingResolutionReason,
      dispositionEvidence: mapping.dispositionEvidence,
    };
  });
}

const aggregateCounts = (tests, field, values) =>
  Object.fromEntries(
    values.map((value) => [value, tests.filter((test) => test[field] === value).length]),
  );

function validateCommitted() {
  const inventory = readJson(inventoryPath);
  const manifest = readJson(manifestPath);
  const contracts = readJson(join(ROOT, 'contracts/registry/contracts.json')).contracts;
  const contractIds = new Set(contracts.map(({ contractId }) => contractId));
  const canonicalText = `${JSON.stringify(inventory)}${JSON.stringify(manifest)}`;
  if (/\/(?:Users|home)\/|[A-Za-z]:\\/.test(canonicalText))
    throw new Error('Absolute workstation path exists in canonical legacy artifacts.');
  if (manifest.sourceSha !== SOURCE_SHA || inventory.sourceSha !== SOURCE_SHA)
    throw new Error('Legacy source SHA changed.');
  if (inventory.tests.length !== manifest.individualTestCount)
    throw new Error('Individual test count does not reconcile.');
  if (
    new Set(inventory.tests.map(({ legacyTestId }) => legacyTestId)).size !== inventory.tests.length
  )
    throw new Error('Duplicate legacy test IDs.');
  for (const entry of inventory.tests) {
    if (normalizeSourcePath(entry.sourcePath) !== entry.sourcePath)
      throw new Error(`Non-canonical source path: ${entry.sourcePath}`);
    if (
      !DISPOSITIONS.includes(entry.disposition) ||
      !entry.dispositionEvidence ||
      !entry.mappingRuleId ||
      !entry.mappingResolutionReason
    )
      throw new Error(`Invalid or unexplained disposition: ${entry.legacyTestId}`);
    if (entry.disposition === 'mapped' && !entry.targetDuskyContractIds.length)
      throw new Error(`Mapped evidence has no target: ${entry.legacyTestId}`);
    if (!entry.targetDuskyContractIds.every((id) => contractIds.has(id)))
      throw new Error(`Broken contract mapping from ${entry.legacyTestId}`);
  }
  const expectedModules = aggregateCounts(inventory.tests, 'sourceModule', [
    'Customer',
    'Merchant',
    'Captain',
    'Admin',
    'Backend',
    'E2E',
  ]);
  const expectedDispositions = aggregateCounts(inventory.tests, 'disposition', DISPOSITIONS);
  if (JSON.stringify(expectedModules) !== JSON.stringify(manifest.countsBySourceModule))
    throw new Error('Source-module counts do not reconcile.');
  if (JSON.stringify(expectedDispositions) !== JSON.stringify(manifest.dispositionCounts))
    throw new Error('Disposition counts do not reconcile.');
  if (
    manifest.testFileCount !== manifest.pinnedTestFileCount + manifest.localEvidenceFileCount ||
    manifest.localEvidenceFileCount !== allLocalEvidencePaths.length
  )
    throw new Error('Evidence-file counts do not reconcile.');
  if (sourceRoot) {
    if (!existsSync(sourceRoot))
      throw new Error(`Pinned reference checkout missing: ${sourceRoot}`);
    if (git(sourceRoot, ['rev-parse', 'HEAD']) !== SOURCE_SHA)
      throw new Error('Reference checkout is not pinned.');
    for (const file of manifest.publicEvidence.files) {
      const content = readFileSync(join(sourceRoot, file.path));
      if (sha256(content) !== file.sha256) throw new Error(`Reference hash changed: ${file.path}`);
    }
  }
  let localSourceContentVerified = false;
  if (preservedRoot) {
    if (!existsSync(preservedRoot))
      throw new Error(`Local evidence checkout missing: ${preservedRoot}`);
    for (const file of manifest.localEvidence) {
      const content = readFileSync(join(preservedRoot, file.path));
      if (sha256(content) !== file.sha256)
        throw new Error(`Local evidence hash changed: ${file.path}`);
    }
    localSourceContentVerified = true;
  }
  console.log(
    `Legacy inventory valid: ${manifest.testFileCount} evidence files, ${manifest.individualTestCount} individual tests; pinned content ${sourceRoot ? 'verified' : 'metadata-only'}, local content ${localSourceContentVerified ? 'verified' : 'metadata-only'}.`,
  );
  return { manifest, localSourceContentVerified, pinnedSourceContentVerified: Boolean(sourceRoot) };
}

if (checking) {
  validateCommitted();
  process.exit(0);
}
if (!sourceRoot || !existsSync(sourceRoot))
  throw new Error('Pass --source <detached pinned MyPetNew checkout>.');
if (!preservedRoot || !existsSync(preservedRoot))
  throw new Error('Pass --preserved-root <read-only dirty MyPetNew checkout>.');
if (git(sourceRoot, ['rev-parse', 'HEAD']) !== SOURCE_SHA)
  throw new Error(`MyPetNew must be pinned at ${SOURCE_SHA}.`);

const trackedFiles = git(sourceRoot, ['ls-files']).split('\n').filter(Boolean);
const testFiles = trackedFiles.filter(isTestKnowledgeFile);
const knowledgeFiles = trackedFiles.filter(
  (path) =>
    /^(?:docs\/|contracts\/|backend\/src\/main\/resources\/db\/migration\/)/.test(path) &&
    /(?:P(?:[1-9]|1[0-6])|contract|architecture|migration|security|regression|test)/i.test(path),
);
const publicFiles = [];
const localEvidence = [];
const tests = [];
for (const path of testFiles) {
  const content = readFileSync(join(sourceRoot, path));
  const fileHash = sha256(content);
  publicFiles.push({
    path,
    sha256: fileHash,
    sourceModule: classifyLegacyEvidence({
      sourcePath: path,
      originalTestName: `File-level validation entrypoint: ${basename(path)}`,
      testCategory: 'file-level test knowledge',
    }).sourceModule,
  });
  tests.push(
    ...inventoryEntries({
      repository: 'Mypetnew',
      sourceSha: SOURCE_SHA,
      path,
      content: content.toString('utf8'),
      fileHash,
    }),
  );
}
for (const path of allLocalEvidencePaths) {
  const absolutePath = join(preservedRoot, path);
  if (!existsSync(absolutePath)) throw new Error(`Local evidence file missing: ${path}`);
  const content = readFileSync(absolutePath);
  const fileHash = sha256(content);
  localEvidence.push({
    path,
    sha256: fileHash,
    category: preservedRegressionPaths.includes(path)
      ? 'preserved-regression'
      : 'additional-dirty-candidate',
    verificationScope: 'local-hash-only',
  });
  tests.push(
    ...inventoryEntries({
      repository: 'Mypetnew-local-uncommitted',
      sourceSha: LOCAL_SOURCE_SHA,
      path,
      content: content.toString('utf8'),
      fileHash,
    }),
  );
}

const countsBySourceModule = aggregateCounts(tests, 'sourceModule', [
  'Customer',
  'Merchant',
  'Captain',
  'Admin',
  'Backend',
  'E2E',
]);
const dispositionCounts = aggregateCounts(tests, 'disposition', DISPOSITIONS);
const knowledgeEvidence = knowledgeFiles.map((path) => ({
  path,
  sha256: sha256(readFileSync(join(sourceRoot, path))),
}));
const manifest = {
  schemaVersion: '2.0.0',
  sourceRepository: SOURCE_REPOSITORY,
  sourceSha: SOURCE_SHA,
  pinnedTestFileCount: testFiles.length,
  preservedLocalRegressionFileCount: preservedRegressionPaths.length,
  additionalLocalEvidenceFileCount: additionalLocalEvidencePaths.length,
  localEvidenceFileCount: localEvidence.length,
  testFileCount: testFiles.length + localEvidence.length,
  individualTestCount: tests.length,
  countsBySourceModule,
  dispositionCounts,
  publicEvidence: {
    verificationScope: 'pinned-public-ci-verifiable',
    sourceRepository: SOURCE_REPOSITORY,
    sourceSha: SOURCE_SHA,
    files: publicFiles,
  },
  localEvidence,
  knowledgeEvidence,
  extractionScriptVersion: SCRIPT_VERSION,
};
mkdirSync(join(ROOT, 'contracts/legacy'), { recursive: true });
writeFileSync(
  inventoryPath,
  `${JSON.stringify({ schemaVersion: '2.0.0', sourceSha: SOURCE_SHA, tests }, null, 2)}\n`,
);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Extracted ${tests.length} individual tests from ${manifest.testFileCount} evidence files.`,
);
