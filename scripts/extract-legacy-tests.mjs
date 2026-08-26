import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE_SHA = '817c6487cdbf18fc282dc0a44538d83e7bc5ef8b';
const SCRIPT_VERSION = '1.0.0';
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const checking = args.includes('--check');
const sourceRoot = option('--source') ?? process.env.MYPETNEW_PATH;
const preservedRoot =
  option('--preserved-root') ??
  process.env.MYPETNEW_PRESERVED_PATH ??
  '/Users/trinadh/projects/mypetnew';
const inventoryPath = join(ROOT, 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json');
const manifestPath = join(ROOT, 'contracts/legacy/MYPETNEW_SOURCE_MANIFEST.json');

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const stableId = (prefix, value) =>
  `${prefix}-${createHash('sha1').update(value).digest('hex').slice(0, 12).toUpperCase()}`;
const git = (cwd, gitArgs) => {
  const result = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${gitArgs.join(' ')} failed`);
  return result.stdout.trim();
};

const preservedPaths = [
  'apps/customer-app/src/__tests__/customer-journey-contracts.test.ts',
  'apps/customer-app/src/__tests__/food-filter-tags.test.ts',
  'apps/customer-app/src/__tests__/p5-product-detail-cart-contract.test.ts',
  'apps/customer-app/src/__tests__/s12-commerce.test.ts',
  'apps/customer-app/src/services/__tests__/paginated-catalog.test.ts',
];
const additionalDirtyTestCandidates = [
  'apps/customer-app/src/demo/__tests__/customer-data.test.ts',
  'apps/customer-app/src/__tests__/demo-isolation-architecture.test.ts',
  'apps/customer-app/src/services/__tests__/backend-capabilities.test.ts',
];

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

function moduleFor(path) {
  if (path.startsWith('apps/customer-app/')) return 'Customer';
  if (path.startsWith('apps/merchant-app/')) return 'Merchant';
  if (path.startsWith('apps/captain-app/')) return 'Captain';
  if (/^apps\/(?:admin|admin-web)\//.test(path)) return 'Admin';
  if (path.startsWith('backend/')) return 'Backend';
  return 'E2E';
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
      if (match && /(?:test|verify|validate|check|gradle|npm|pnpm)/i.test(match[1]))
        cases.push({ suite, name: `CI: ${match[1].trim()}`, kind: 'CI-only test command' });
    }
  } else if (/\.(?:sh)$/i.test(path)) {
    for (const line of content.split('\n')) {
      const command = line.trim();
      if (
        command &&
        !command.startsWith('#') &&
        /(?:test|verify|validate|check|gradle|npm|pnpm)/i.test(command)
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

function targetContracts(module, text) {
  const value = text.toLowerCase();
  const contains = (...tokens) => tokens.some((token) => value.includes(token));
  if (module === 'Customer') {
    if (contains('auth', 'otp', 'session')) return ['CUS-AUTH-001'];
    if (contains('cart', 'quote', 'checkout')) return ['CUS-CART-001', 'CUS-CHK-001'];
    if (contains('payment', 'cashfree', 'refund', 'cod')) return ['CUS-PAY-001'];
    if (contains('appointment', 'groom', 'veterinar', 'service')) return ['CUS-APT-002'];
    if (contains('order', 'delivery')) return ['CUS-ORD-001'];
    if (contains('loyalty', 'reward', 'star')) return ['CUS-LOY-001'];
    if (contains('recurring', 'renewal')) return ['CUS-REC-001'];
    if (contains('profile', 'address', 'pet')) return ['CUS-PROF-001'];
    if (contains('notification', 'deep link')) return ['CUS-NOT-001'];
    if (contains('offline', 'retry', 'reconnect')) return ['CUS-OFF-001'];
    return ['CUS-PROV-001', 'CUS-SEARCH-001'];
  }
  if (module === 'Merchant') {
    if (contains('auth', 'session', 'outlet')) return ['MER-AUTH-001', 'MER-OUTLET-001'];
    if (contains('inventory', 'stock', 'movement')) return ['MER-INV-001', 'MER-MOV-001'];
    if (contains('barcode')) return ['MER-BAR-001'];
    if (contains('appointment')) return ['MER-APT-001'];
    if (contains('order')) return ['MER-ORD-001'];
    if (contains('offline', 'sync', 'replay')) return ['MER-SYNC-001'];
    return ['MER-CAT-001'];
  }
  if (module === 'Captain') {
    if (contains('auth', 'onboarding')) return ['CAP-AUTH-001'];
    if (contains('location', 'gps', 'background')) return ['CAP-GPS-001'];
    if (contains('offline', 'network', 'recovery', 'reconciliation')) return ['CAP-OFF-001'];
    if (contains('notification')) return ['CAP-NOT-001'];
    if (contains('proof')) return ['CAP-POD-001'];
    if (contains('state', 'lifecycle')) return ['CAP-STATE-001'];
    return ['CAP-ASG-001', 'CAP-CON-001'];
  }
  if (module === 'Admin')
    return contains('auth', 'protect', 'role') ? ['ADM-RBAC-001'] : ['ADM-MER-001'];
  if (module === 'Backend') {
    if (contains('auth', 'bearer', 'principal', 'security', 'identity'))
      return ['BE-AUTH-001', 'BE-OBJ-001'];
    if (contains('merchant', 'outlet', 'tenant')) return ['BE-TENANT-001'];
    if (contains('payment', 'cashfree', 'webhook')) return ['BE-PAY-001'];
    if (contains('inventory', 'catalog', 'stock', 'barcode')) return ['BE-INV-001'];
    if (contains('migration', 'flyway', 'jdbc', 'persistence')) return ['BE-MIG-001'];
    if (contains('concurr', 'race', 'replay', 'idempot')) return ['BE-IDEMP-001', 'BE-CON-001'];
    if (contains('notification', 'firebase', 'device')) return ['BE-NOT-001'];
    if (contains('order', 'delivery', 'appointment', 'state')) return ['BE-STATE-001'];
    return ['BE-VALID-001'];
  }
  return ['E2E-ORDER-001'];
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

function inventoryEntries(repository, sourceSha, path, content) {
  const sourceModule = moduleFor(path);
  return casesFrom(path, content).map(({ suite, name, kind }, index) => ({
    legacyTestId: stableId(
      repository === 'Mypetnew' ? 'LEG' : 'LOCAL',
      `${path}\0${name}\0${index}`,
    ),
    sourceRepository: repository,
    sourceSha,
    sourcePath: path,
    sourceModule,
    suiteClassName: suite,
    originalTestName: name,
    testCategory: kind,
    behavior: name,
    producer: sourceModule === 'Backend' ? 'backend' : `${sourceModule.toLowerCase()} module`,
    consumers:
      sourceModule === 'E2E'
        ? ['Customer', 'Merchant', 'Captain', 'Admin', 'Backend']
        : [sourceModule, 'Backend'],
    userRole: sourceModule.toLowerCase(),
    classifications: classifications(`${path} ${name}`),
    launchCriticality:
      /(auth|checkout|payment|order|inventory|delivery|tenant|outlet|concurr|migration)/i.test(
        `${path} ${name}`,
      )
        ? 'launch-critical'
        : 'useful',
    targetDuskyContractIds: targetContracts(sourceModule, `${path} ${name}`),
    disposition: 'mapped',
    notes:
      repository === 'Mypetnew'
        ? 'Behavioral intent mapped from the pinned tree; implementation is not copied.'
        : 'Preserved uncommitted regression intent mapped independently; original file remains untouched.',
  }));
}

function validateCommitted() {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const contracts = JSON.parse(
    readFileSync(join(ROOT, 'contracts/registry/contracts.json'), 'utf8'),
  ).contracts;
  const ids = new Set(contracts.map(({ contractId }) => contractId));
  if (manifest.sourceSha !== SOURCE_SHA) throw new Error('Legacy source SHA changed.');
  if (inventory.tests.length !== manifest.individualTestCount)
    throw new Error('Individual test count does not reconcile.');
  if (
    new Set(inventory.tests.map(({ legacyTestId }) => legacyTestId)).size !== inventory.tests.length
  )
    throw new Error('Duplicate legacy test IDs.');
  for (const test of inventory.tests) {
    if (
      ![
        'mapped',
        'duplicate',
        'obsolete-with-evidence',
        'implementation-specific-rewritten',
        'requires-business-decision',
      ].includes(test.disposition)
    )
      throw new Error(`Invalid disposition ${test.disposition}`);
    if (!test.targetDuskyContractIds.every((id) => ids.has(id)))
      throw new Error(`Broken contract mapping from ${test.legacyTestId}`);
  }
  const dispositionTotal = Object.values(manifest.dispositionCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (dispositionTotal !== manifest.individualTestCount)
    throw new Error('Disposition counts do not reconcile.');
  if (sourceRoot && existsSync(sourceRoot)) {
    if (git(sourceRoot, ['rev-parse', 'HEAD']) !== SOURCE_SHA)
      throw new Error('Reference checkout is not pinned.');
    for (const file of manifest.files) {
      const content = readFileSync(join(sourceRoot, file.path));
      if (sha256(content) !== file.sha256) throw new Error(`Reference hash changed: ${file.path}`);
    }
  }
  console.log(
    `Legacy inventory valid: ${manifest.testFileCount} evidence files, ${manifest.individualTestCount} individual tests.`,
  );
}

if (checking) {
  validateCommitted();
  process.exit(0);
}
if (!sourceRoot || !existsSync(sourceRoot))
  throw new Error('Pass --source <detached pinned MyPetNew checkout>.');
if (git(sourceRoot, ['rev-parse', 'HEAD']) !== SOURCE_SHA)
  throw new Error(`MyPetNew must be pinned at ${SOURCE_SHA}.`);

const trackedFiles = git(sourceRoot, ['ls-files']).split('\n').filter(Boolean);
const testFiles = trackedFiles.filter(isTestKnowledgeFile);
const knowledgeFiles = trackedFiles.filter(
  (path) =>
    /^(?:docs\/|contracts\/|backend\/src\/main\/resources\/db\/migration\/)/.test(path) &&
    /(?:P(?:[1-9]|1[0-6])|contract|architecture|migration|security|regression|test)/i.test(path),
);
const fileRecords = [];
const tests = [];
for (const path of testFiles) {
  const content = readFileSync(join(sourceRoot, path));
  fileRecords.push({ path, sha256: sha256(content), sourceModule: moduleFor(path) });
  tests.push(...inventoryEntries('Mypetnew', SOURCE_SHA, path, content.toString('utf8')));
}

const preservedRecords = [];
for (const path of preservedPaths) {
  const absolutePath = join(preservedRoot, path);
  if (!existsSync(absolutePath))
    throw new Error(`Preserved regression file missing: ${absolutePath}`);
  const content = readFileSync(absolutePath);
  preservedRecords.push({ path: absolutePath, sha256: sha256(content) });
  tests.push(
    ...inventoryEntries(
      'preserved-local-regression',
      `uncommitted@${SOURCE_SHA}`,
      absolutePath,
      content.toString('utf8'),
    ),
  );
}
const additionalCandidates = additionalDirtyTestCandidates
  .filter((path) => existsSync(join(preservedRoot, path)))
  .map((path) => {
    const absolutePath = join(preservedRoot, path);
    return {
      path: absolutePath,
      sha256: sha256(readFileSync(absolutePath)),
      note: 'Dirty test candidate outside the reported five; preserved and disclosed, but not counted as one of the five.',
    };
  });

const countsByApplication = Object.fromEntries(
  ['Customer', 'Merchant', 'Captain', 'Admin', 'Backend', 'E2E'].map((module) => [
    module,
    tests.filter((test) => test.sourceModule === module).length,
  ]),
);
const dispositionCounts = Object.fromEntries(
  [
    'mapped',
    'duplicate',
    'obsolete-with-evidence',
    'implementation-specific-rewritten',
    'requires-business-decision',
  ].map((disposition) => [
    disposition,
    tests.filter((test) => test.disposition === disposition).length,
  ]),
);
const knowledgeEvidence = knowledgeFiles.map((path) => ({
  path,
  sha256: sha256(readFileSync(join(sourceRoot, path))),
}));
const manifest = {
  schemaVersion: '1.0.0',
  sourceRepository: 'https://github.com/thrinnadhh/Mypetnew.git',
  sourceSha: SOURCE_SHA,
  pinnedTestFileCount: testFiles.length,
  preservedLocalRegressionFileCount: preservedRecords.length,
  testFileCount: testFiles.length + preservedRecords.length,
  individualTestCount: tests.length,
  countsByApplication,
  dispositionCounts,
  files: fileRecords,
  preservedLocalRegressionFiles: preservedRecords,
  additionalDirtyTestCandidates: additionalCandidates,
  knowledgeEvidence,
  extractionTimestamp: new Date().toISOString(),
  extractionScriptVersion: SCRIPT_VERSION,
};
mkdirSync(join(ROOT, 'contracts/legacy'), { recursive: true });
writeFileSync(
  inventoryPath,
  `${JSON.stringify({ schemaVersion: '1.0.0', sourceSha: SOURCE_SHA, tests }, null, 2)}\n`,
);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Extracted ${tests.length} individual tests from ${manifest.testFileCount} evidence files.`,
);
