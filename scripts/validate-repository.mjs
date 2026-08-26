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
export function validateRepository(root = DEFAULT_ROOT) {
  const missing = required.filter((path) => !existsSync(join(root, path)));
  if (missing.length) throw new Error(`Missing required repository paths:\n${missing.join('\n')}`);
  const competingLockfiles = ['package-lock.json', 'yarn.lock', 'bun.lockb'].filter((path) =>
    existsSync(join(root, path)),
  );
  if (competingLockfiles.length)
    throw new Error(`Competing root lockfiles: ${competingLockfiles.join(', ')}`);
  for (const module of ['customer-app', 'merchant-app', 'captain-app', 'admin-web']) {
    const pkg = JSON.parse(readFileSync(join(root, 'apps', module, 'package.json'), 'utf8'));
    for (const command of ['format:check', 'lint', 'typecheck', 'test', 'config:validate', 'build'])
      if (!pkg.scripts?.[command]) throw new Error(`${module} missing ${command}`);
  }
  return { requiredPathCount: required.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--root');
  validateRepository(resolve(index >= 0 ? args[index + 1] : DEFAULT_ROOT));
  console.log(
    'Repository policy valid: all required modules and one lockfile strategy are present.',
  );
}
