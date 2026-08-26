import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const required = [
  'apps/customer-app',
  'apps/merchant-app',
  'apps/captain-app',
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
  'pnpm-lock.yaml',
  'gradlew',
];

export function validateSetupNodeCaching(workflow) {
  const setupNodePattern = /^\s*-\s+uses:\s+actions\/setup-node@[0-9a-f]{40}\s*$/gm;
  const cacheDisabledPattern =
    /^\s*-\s+uses:\s+actions\/setup-node@[0-9a-f]{40}\s*$\n^\s+with:\s*\{[^}\n]*package-manager-cache:\s*false[^}\n]*\}\s*$/gm;
  const setupNodeCount = [...workflow.matchAll(setupNodePattern)].length;
  const cacheDisabledCount = [...workflow.matchAll(cacheDisabledPattern)].length;
  if (setupNodeCount === 0)
    throw new Error('P0 workflow must pin at least one actions/setup-node use.');
  if (cacheDisabledCount !== setupNodeCount)
    throw new Error(
      'Every setup-node step must set package-manager-cache: false so Corepack can enable pnpm first.',
    );
  return setupNodeCount;
}

const REQUIRED_CI_JOBS = [
  'repository-policy',
  'legacy-inventory',
  'contract-registry',
  'customer-foundation',
  'merchant-foundation',
  'captain-foundation',
  'admin-foundation',
  'backend-foundation',
  'cross-app-scenarios',
  'build-readiness',
];

const jobBody = (workflow, jobName) => {
  const match = workflow.match(
    new RegExp(`^  ${jobName}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]+:\\n|(?![\\s\\S]))`, 'm'),
  );
  if (!match) throw new Error(`P0 workflow is missing required job ${jobName}.`);
  return match[1];
};

export function validateExactHeadWorkflow(workflow) {
  if (
    !/^\s{2}EXPECTED_DUSKY_SHA:\s*\$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}\s*$/m.test(
      workflow,
    )
  )
    throw new Error(
      'P0 workflow must derive EXPECTED_DUSKY_SHA from the PR head SHA or github.sha.',
    );

  let verifiedCheckoutCount = 0;
  for (const jobName of REQUIRED_CI_JOBS) {
    const body = jobBody(workflow, jobName);
    const checkout = body.match(
      /^\s{6}- uses: actions\/checkout@[0-9a-f]{40}\s*$[\s\S]*?(?=^\s{6}- (?:uses|name|if|run):|(?![\s\S]))/m,
    )?.[0];
    if (!checkout) throw new Error(`${jobName} is missing its primary immutable Dusky checkout.`);
    if (!/^\s{10}ref:\s*\$\{\{ env\.EXPECTED_DUSKY_SHA \}\}\s*$/m.test(checkout))
      throw new Error(`${jobName} checkout ref must use the exact expected head SHA.`);
    if (!/^\s{10}fetch-depth:\s*0\s*$/m.test(checkout))
      throw new Error(`${jobName} exact-head checkout must preserve full history.`);

    const assertion = body.match(
      /^\s{6}- name: Assert exact Dusky checkout\s*$[\s\S]*?(?=^\s{6}- (?:uses|name|if|run):|(?![\s\S]))/m,
    )?.[0];
    if (!assertion) throw new Error(`${jobName} is missing the runtime exact-head SHA assertion.`);
    if (!/actual_sha="\$\(git rev-parse HEAD\)"/.test(assertion))
      throw new Error(`${jobName} runtime SHA check must execute git rev-parse HEAD.`);
    if (
      !/echo "expected_sha=\$EXPECTED_DUSKY_SHA"/.test(assertion) ||
      !/echo "actual_sha=\$actual_sha"/.test(assertion)
    )
      throw new Error(`${jobName} must print both expected and actual checkout SHA values.`);
    if (!/test "\$actual_sha" = "\$EXPECTED_DUSKY_SHA"/.test(assertion))
      throw new Error(`${jobName} exact-head assertion must fail on SHA mismatch.`);
    verifiedCheckoutCount += 1;
  }
  return { jobCount: REQUIRED_CI_JOBS.length, verifiedCheckoutCount };
}

export function validateRepository(root = DEFAULT_ROOT) {
  const missing = required.filter((path) => !existsSync(join(root, path)));
  if (missing.length) throw new Error(`Missing required repository paths:\n${missing.join('\n')}`);
  const competingLockfiles = ['package-lock.json', 'yarn.lock', 'bun.lockb'].filter((path) =>
    existsSync(join(root, path)),
  );
  if (competingLockfiles.length)
    throw new Error(`Competing root lockfiles: ${competingLockfiles.join(', ')}`);
  const workflow = readFileSync(join(root, '.github/workflows/p0-foundation.yml'), 'utf8');
  const setupNodeJobCount = validateSetupNodeCaching(workflow);
  validateExactHeadWorkflow(workflow);
  if (
    !/fetch-depth:\s*0/.test(workflow) ||
    !/validate:contracts --base-sha "\$\{\{ github\.event\.pull_request\.base\.sha \}\}"/.test(
      workflow,
    )
  )
    throw new Error('Pull-request contract validation must load the actual fetched base SHA.');
  if (
    !/repository:\s*thrinnadhh\/Mypetnew/.test(workflow) ||
    !/ref:\s*817c6487cdbf18fc282dc0a44538d83e7bc5ef8b/.test(workflow) ||
    !/MYPETNEW_PATH=\.reference\/mypetnew pnpm validate:legacy/.test(workflow)
  )
    throw new Error('Legacy CI must verify a clean MyPetNew checkout at the pinned SHA.');
  for (const module of ['customer-app', 'merchant-app', 'captain-app', 'admin-web']) {
    const pkg = JSON.parse(readFileSync(join(root, 'apps', module, 'package.json'), 'utf8'));
    for (const command of ['format:check', 'lint', 'typecheck', 'test', 'config:validate', 'build'])
      if (!pkg.scripts?.[command]) throw new Error(`${module} missing ${command}`);
  }
  return { requiredPathCount: required.length, setupNodeJobCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--root');
  validateRepository(resolve(index >= 0 ? args[index + 1] : DEFAULT_ROOT));
  console.log(
    'Repository policy valid: all required modules and one lockfile strategy are present.',
  );
}
