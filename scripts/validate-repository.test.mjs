import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSetupNodeCaching } from './validate-repository.mjs';

test('rejects setup-node automatic package-manager caching before Corepack', () => {
  assert.throws(
    () =>
      validateSetupNodeCaching(`
steps:
  - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444
    with: { node-version: '22' }
  - run: corepack enable && pnpm install --frozen-lockfile
`),
    /package-manager-cache: false/,
  );
});

test('accepts setup-node when automatic package-manager caching is disabled', () => {
  assert.equal(
    validateSetupNodeCaching(`
steps:
  - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444
    with: { node-version: '22', package-manager-cache: false }
  - run: corepack enable && pnpm install --frozen-lockfile
`),
    1,
  );
});
