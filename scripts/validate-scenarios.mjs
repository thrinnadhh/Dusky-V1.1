import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export function validateScenarios(root = DEFAULT_ROOT) {
  const directory = join(root, 'contracts/scenarios');
  const schema = JSON.parse(readFileSync(join(directory, 'scenario.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  let count = 0;
  const ids = new Set();
  for (const name of readdirSync(directory).filter(
    (value) => value.endsWith('.json') && value !== 'scenario.schema.json',
  )) {
    const catalog = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    if (!validate(catalog))
      throw new Error(`${name}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`);
    for (const scenario of catalog.scenarios) {
      if (ids.has(scenario.scenarioId))
        throw new Error(`Duplicate scenario ID: ${scenario.scenarioId}`);
      ids.add(scenario.scenarioId);
      if (
        scenario.priority === 'P0-launch' &&
        (scenario.given.length < 2 || scenario.when.length < 2 || scenario.then.length < 3)
      )
        throw new Error(`Launch scenario is not detailed: ${scenario.scenarioId}`);
      count += 1;
    }
  }
  return { scenarioCount: count };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const result = validateScenarios(resolve(rootIndex >= 0 ? args[rootIndex + 1] : DEFAULT_ROOT));
  console.log(`Scenario catalogs valid: ${result.scenarioCount} planned scenarios.`);
}
