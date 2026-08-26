import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ignored = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'build',
  '.next',
  '.expo',
  '.gradle',
]);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (ignored.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isExecutableTest = (path) =>
  /(?:^|\/)(?:[^/]+\.(?:test|spec)\.(?:js|jsx|mjs|cjs|ts|tsx)|src\/test\/.+\.kt)$/i.test(path);

export function validateTestIntegrity(root = DEFAULT_ROOT) {
  const failures = [];
  const testFiles = walk(root).filter(isExecutableTest);
  const forbiddenPatterns = [
    [/\b(?:describe|it|test)\.only\s*\(/, 'focused test'],
    [/\b(?:describe|it|test)\.skip\s*\(/, 'skipped test'],
    [/\b(?:xdescribe|xit)\s*\(/, 'disabled suite/test'],
    [/\btest\.todo\s*\(/, 'todo test'],
    [/@Disabled\b/, 'disabled JUnit test'],
    [/expect\(true\)\.to(?:Be|Equal)\(true\)/, 'placeholder assertion'],
  ];
  for (const path of testFiles) {
    const content = readFileSync(path, 'utf8');
    for (const [pattern, label] of forbiddenPatterns)
      if (pattern.test(content)) failures.push(`${label}: ${path}`);
    const caseCount =
      (content.match(/\b(?:it|test)\s*\(/g) ?? []).length +
      (content.match(/@Test\b/g) ?? []).length;
    if (caseCount === 0) failures.push(`empty test file: ${path}`);
  }
  const modules = ['customer-app', 'merchant-app', 'captain-app', 'admin-web'];
  for (const module of modules) {
    const packagePath = join(root, 'apps', module, 'package.json');
    if (!existsSync(packagePath)) failures.push(`missing required application: ${module}`);
    else if (!JSON.parse(readFileSync(packagePath, 'utf8')).scripts?.test)
      failures.push(`missing module test command: ${module}`);
  }
  if (!existsSync(join(root, 'backend/src/test'))) failures.push('missing backend tests');
  if (failures.length) throw new Error(failures.join('\n'));
  return { testFileCount: testFiles.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--root');
  const result = validateTestIntegrity(resolve(index >= 0 ? args[index + 1] : DEFAULT_ROOT));
  console.log(
    `Test integrity valid: ${result.testFileCount} executable test files, zero disabled/focused/placeholder tests.`,
  );
}
