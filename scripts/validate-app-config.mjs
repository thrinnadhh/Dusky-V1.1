import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const module = process.argv[2];
if (!['customer-app', 'merchant-app', 'captain-app', 'admin-web'].includes(module))
  throw new Error('Pass a known application module.');
if (module === 'admin-web') {
  const config = readFileSync(join(root, 'apps/admin-web/next.config.ts'), 'utf8');
  if (!config.includes('env: {}')) throw new Error('Admin config must not expose server secrets.');
} else {
  const config = JSON.parse(readFileSync(join(root, 'apps', module, 'app.json'), 'utf8')).expo;
  if (!config.android?.package || !config.ios?.bundleIdentifier || !config.scheme)
    throw new Error(`${module} lacks distinct mobile identity.`);
}
console.log(`${module} configuration valid.`);
