import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateExactHeadWorkflow } from './validate-repository.mjs';

const root = new URL('..', import.meta.url).pathname;
const workflow = () => readFileSync(`${root}.github/workflows/p0-foundation.yml`, 'utf8');

test('every job explicitly checks out and proves the expected Dusky SHA', () => {
  const result = validateExactHeadWorkflow(workflow());
  assert.equal(result.jobCount, 10);
  assert.equal(result.verifiedCheckoutCount, 10);
});

test('repository policy rejects removal of an exact-head checkout ref', () => {
  const weakened = workflow().replace(
    /^\s+ref:\s*\$\{\{ env\.EXPECTED_DUSKY_SHA \}\}\s*$/m,
    '',
  );
  assert.throws(() => validateExactHeadWorkflow(weakened), /exact.*head|expected.*sha|checkout ref/i);
});

test('repository policy rejects removal of the runtime SHA assertion', () => {
  const weakened = workflow().replace('actual_sha="$(git rev-parse HEAD)"', 'actual_sha="unchecked"');
  assert.throws(() => validateExactHeadWorkflow(weakened), /git rev-parse HEAD|runtime.*sha/i);
});

test('repository policy rejects an assertion that does not fail on SHA mismatch', () => {
  const weakened = workflow().replace(
    'test "$actual_sha" = "$EXPECTED_DUSKY_SHA"',
    'echo "comparison omitted"',
  );
  assert.throws(() => validateExactHeadWorkflow(weakened), /fail|assert|mismatch/i);
});
