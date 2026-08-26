import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateTestIntegrity } from './validate-test-integrity.mjs';

const root = new URL('..', import.meta.url).pathname;

test('committed executable tests have integrity', () =>
  assert.ok(validateTestIntegrity(root).testFileCount >= 8));

test('a skipped test is rejected', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'dusky-integrity-'));
  for (const app of ['customer-app', 'merchant-app', 'captain-app', 'admin-web']) {
    mkdirSync(join(fixture, 'apps', app), { recursive: true });
    writeFileSync(
      join(fixture, 'apps', app, 'package.json'),
      JSON.stringify({ scripts: { test: 'test' } }),
    );
  }
  mkdirSync(join(fixture, 'backend/src/test'), { recursive: true });
  mkdirSync(join(fixture, 'src'), { recursive: true });
  const forbidden = ['test', 'skip'].join('.');
  writeFileSync(join(fixture, 'src/focused.test.ts'), `${forbidden}('disabled', () => {});`);
  assert.throws(() => validateTestIntegrity(fixture), /skipped test/);
});
