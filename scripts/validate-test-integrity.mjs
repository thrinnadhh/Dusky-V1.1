import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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

const identifierText = (node) => (ts.isIdentifier(node) ? node.text : undefined);
const primitive = (node) => {
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { type: 'boolean', value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { type: 'boolean', value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { type: 'null', value: null };
  if (ts.isStringLiteralLike(node)) return { type: 'string', value: node.text };
  if (ts.isNumericLiteral(node)) return { type: 'number', value: Number(node.text) };
  return undefined;
};
const samePrimitive = (left, right) => {
  const a = primitive(left);
  const b = primitive(right);
  return a && b && a.type === b.type && a.value === b.value;
};

function analyzeJavaScript(path, content) {
  const extension = extname(path).toLowerCase();
  const kind = extension === '.tsx' || extension === '.jsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind);
  const failures = [];
  let executableCaseCount = 0;
  let suiteCount = 0;

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const direct = identifierText(callee);
      if (direct === 'describe') suiteCount += 1;
      if (direct === 'it' || direct === 'test') executableCaseCount += 1;
      if (direct === 'fit' || direct === 'fdescribe') {
        failures.push(`focused test: ${path}`);
        if (direct === 'fit') executableCaseCount += 1;
        else suiteCount += 1;
      }
      if (['xit', 'xtest', 'xdescribe'].includes(direct))
        failures.push(`disabled suite/test: ${path}`);

      if (ts.isPropertyAccessExpression(callee)) {
        const base = identifierText(callee.expression);
        const modifier = callee.name.text;
        if (base === 'describe') suiteCount += 1;
        if (['it', 'test'].includes(base) && !['skip', 'todo'].includes(modifier))
          executableCaseCount += 1;
        if (['describe', 'it', 'test'].includes(base) && modifier === 'only')
          failures.push(`focused test: ${path}`);
        if (['describe', 'it', 'test'].includes(base) && modifier === 'skip')
          failures.push(`skipped test: ${path}`);
        if (['describe', 'it', 'test'].includes(base) && modifier === 'todo')
          failures.push(`todo test: ${path}`);

        if (['toBe', 'toEqual', 'toStrictEqual'].includes(modifier)) {
          const expectCall = callee.expression;
          if (
            ts.isCallExpression(expectCall) &&
            identifierText(expectCall.expression) === 'expect' &&
            expectCall.arguments.length === 1 &&
            node.arguments.length === 1 &&
            samePrimitive(expectCall.arguments[0], node.arguments[0])
          )
            failures.push(`placeholder assertion: ${path}`);
        }
        if (base === 'assert' && ['equal', 'strictEqual', 'deepEqual'].includes(modifier)) {
          if (node.arguments.length >= 2 && samePrimitive(node.arguments[0], node.arguments[1]))
            failures.push(`placeholder assertion: ${path}`);
        }
        if (base === 'assert' && modifier === 'ok' && primitive(node.arguments[0])?.value === true)
          failures.push(`placeholder assertion: ${path}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (source.parseDiagnostics.length) failures.push(`test source does not parse: ${path}`);
  if (executableCaseCount === 0)
    failures.push(
      suiteCount ? `suite has no executable cases: ${path}` : `empty test file: ${path}`,
    );
  return failures;
}

function maskKotlinCommentsAndStrings(content) {
  let result = '';
  let index = 0;
  let state = 'code';
  while (index < content.length) {
    const pair = content.slice(index, index + 2);
    const triple = content.slice(index, index + 3);
    const character = content[index];
    if (state === 'code' && pair === '//') {
      state = 'line-comment';
      result += '  ';
      index += 2;
      continue;
    }
    if (state === 'code' && pair === '/*') {
      state = 'block-comment';
      result += '  ';
      index += 2;
      continue;
    }
    if (state === 'code' && triple === '"""') {
      state = 'triple-string';
      result += '   ';
      index += 3;
      continue;
    }
    if (state === 'code' && character === '"') {
      state = 'string';
      result += ' ';
      index += 1;
      continue;
    }
    if (state === 'line-comment' && character === '\n') state = 'code';
    else if (state === 'block-comment' && pair === '*/') {
      state = 'code';
      result += '  ';
      index += 2;
      continue;
    } else if (state === 'triple-string' && triple === '"""') {
      state = 'code';
      result += '   ';
      index += 3;
      continue;
    } else if (state === 'string' && character === '"' && content[index - 1] !== '\\')
      state = 'code';
    result += state === 'code' || character === '\n' ? character : ' ';
    index += 1;
  }
  return result;
}

function analyzeKotlin(path, content) {
  const source = maskKotlinCommentsAndStrings(content);
  const failures = [];
  if (/@Disabled\b/.test(source)) failures.push(`disabled JUnit test: ${path}`);
  if (/@Ignore\b/.test(source)) failures.push(`ignored JUnit test: ${path}`);
  if (
    /assertTrue\s*\(\s*true\s*\)/.test(source) ||
    /assertEquals\s*\(\s*1\s*,\s*1\s*\)/.test(source)
  )
    failures.push(`placeholder assertion: ${path}`);
  if ((source.match(/@Test\b/g) ?? []).length === 0) failures.push(`empty test file: ${path}`);
  return failures;
}

function validateTestCommands(root, files) {
  const failures = [];
  for (const path of files.filter((file) => file.endsWith('package.json'))) {
    const packageJson = JSON.parse(readFileSync(path, 'utf8'));
    const command = packageJson.scripts?.test;
    if (!command) continue;
    if (/\|\|\s*(?:true|exit\s+0)\b|;\s*true\s*$|set\s+\+e/.test(command))
      failures.push(`suppressed failing-test exit: ${path}`);
    if (/--passWithNoTests\b|--pass-with-no-tests\b/.test(command))
      failures.push(`zero-test bypass: ${path}`);
  }
  const rootPackage = join(root, 'package.json');
  if (!existsSync(rootPackage)) return failures;
  const rootTest = JSON.parse(readFileSync(rootPackage, 'utf8')).scripts?.test;
  if (!rootTest) failures.push('missing root test command');
  return failures;
}

export function validateTestIntegrity(root = DEFAULT_ROOT) {
  const failures = [];
  const files = walk(root);
  const testFiles = files.filter(isExecutableTest);
  for (const path of testFiles) {
    const content = readFileSync(path, 'utf8');
    failures.push(
      ...(path.endsWith('.kt') ? analyzeKotlin(path, content) : analyzeJavaScript(path, content)),
    );
  }
  const modules = ['customer-app', 'merchant-app', 'captain-app', 'admin-web'];
  for (const module of modules) {
    const packagePath = join(root, 'apps', module, 'package.json');
    if (!existsSync(packagePath)) failures.push(`missing required application: ${module}`);
    else if (!JSON.parse(readFileSync(packagePath, 'utf8')).scripts?.test)
      failures.push(`missing module test command: ${module}`);
  }
  if (!existsSync(join(root, 'backend/src/test'))) failures.push('missing backend tests');
  failures.push(...validateTestCommands(root, files));
  if (failures.length) throw new Error([...new Set(failures)].join('\n'));
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
