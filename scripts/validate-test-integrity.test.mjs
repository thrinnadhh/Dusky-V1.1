import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateTestIntegrity } from './validate-test-integrity.mjs';

const root = new URL('..', import.meta.url).pathname;

test('committed executable tests have integrity', () =>
  assert.ok(validateTestIntegrity(root).testFileCount >= 8));

function fixtureWith(content, extension = 'ts') {
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
  const testPath =
    extension === 'kt'
      ? join(fixture, 'backend/src/test/CandidateTest.kt')
      : join(fixture, `src/candidate.test.${extension}`);
  writeFileSync(testPath, content);
  return fixture;
}

for (const [name, source] of [
  ['describe.only', "describe.only('suite', () => { test('case', () => {}); });"],
  ['it.only', "it.only('case', () => {});"],
  ['test.only', "test.only('case', () => {});"],
  ['fit', "fit('case', () => {});"],
  ['fdescribe', "fdescribe('suite', () => { test('case', () => {}); });"],
  ['describe.skip', "describe.skip('suite', () => { test('case', () => {}); });"],
  ['it.skip', "it.skip('case', () => {});"],
  ['test.skip', "test.skip('case', () => {});"],
  ['xit', "xit('case', () => {});"],
  ['xtest', "xtest('case', () => {});"],
  ['xdescribe', "xdescribe('suite', () => { test('case', () => {}); });"],
  ['test.todo', "test.todo('case');"],
  ['it.todo', "it.todo('case');"],
  ['describe.todo', "describe.todo('suite');"],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => validateTestIntegrity(fixtureWith(source)),
      /focused|skipped|disabled|todo/i,
    );
  });
}

for (const [name, source] of [
  ['expect true equality', "test('case', () => expect(true).toBe(true));"],
  ['expect literal equality', "test('case', () => expect('same').toEqual('same'));"],
  ['assert strict equality', "test('case', () => assert.equal(1, 1));"],
  ['assert true', "test('case', () => assert.ok(true));"],
]) {
  test(`rejects placeholder assertion: ${name}`, () => {
    assert.throws(() => validateTestIntegrity(fixtureWith(source)), /placeholder assertion/i);
  });
}

test('ignores forbidden words in comments and string literals', () => {
  const source = `
    // test.skip('documentation only')
    const example = "describe.only('not executable')";
    test('real case', () => expect(example.length).toBeGreaterThan(0));
  `;
  assert.doesNotThrow(() => validateTestIntegrity(fixtureWith(source)));
});

test('rejects empty test files and suites with no executable cases', () => {
  assert.throws(() => validateTestIntegrity(fixtureWith('')), /empty test file/i);
  assert.throws(
    () => validateTestIntegrity(fixtureWith("describe('suite', () => {});")),
    /no executable cases|empty test file/i,
  );
});

for (const [annotation, label] of [
  ['@Disabled', 'disabled'],
  ['@Ignore', 'ignored'],
]) {
  test(`rejects JUnit ${annotation}`, () => {
    const source = `${annotation}\n@Test\nfun \`case\`() { assertEquals(1, value()) }`;
    assert.throws(
      () => validateTestIntegrity(fixtureWith(source, 'kt')),
      new RegExp(`${label}|disabled|ignored`, 'i'),
    );
  });
}

test('rejects suppressed test failures and zero-test bypass flags', () => {
  for (const command of ['vitest run || true', 'vitest run --passWithNoTests']) {
    const fixture = fixtureWith("test('case', () => expect(value()).toBe(1));");
    const packagePath = join(fixture, 'apps/customer-app/package.json');
    writeFileSync(packagePath, JSON.stringify({ scripts: { test: command } }));
    assert.throws(
      () => validateTestIntegrity(fixture),
      /suppressed failing-test exit|zero-test bypass/i,
    );
  }
});
