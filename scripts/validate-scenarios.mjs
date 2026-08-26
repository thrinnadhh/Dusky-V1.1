import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const textOf = (value) => JSON.stringify(value ?? '').toLowerCase();
const hasAuthenticatedPrecondition = (scenario) =>
  /authenticated (?:customer|actor|role|session).*(?:exists|required|signed in)|requires? an authenticated/i.test(
    (scenario.given ?? []).join(' ').replaceAll(/\bunauthenticated\b/gi, 'guest'),
  );

const REQUIRED_MULTI_STAGE_CHECKPOINTS = {
  'E2E-ORDER-001': [
    'quote-cart-confirmation',
    'merchant-acceptance',
    'merchant-rejection',
    'inventory-reservation',
    'captain-assignment',
    'captain-acceptance',
    'pickup',
    'delivery',
    'cancellation-failure-compensation',
    'terminal-visibility',
  ],
  'E2E-APT-001': [
    'slot-availability',
    'slot-hold',
    'booking',
    'merchant-confirmation',
    'merchant-rejection',
    'completion',
    'cancellation',
    'no-show',
    'refund-compensation',
    'terminal-visibility',
  ],
};
const DETAILED_TRANSITION_FIELDS = [
  'checkpoint',
  'initiatingActor',
  'authorizedActors',
  'from',
  'to',
  'trigger',
  'interaction',
  'databaseInvariant',
  'idempotencyAndCorrelation',
  'visibility',
  'failureResult',
  'businessDecisionRefs',
];

const validateMultiStageLifecycle = (scenario, contract) => {
  const required = REQUIRED_MULTI_STAGE_CHECKPOINTS[contract.contractId];
  if (!required) return;
  const transitions = scenario.stateTransitions ?? [];
  let previousIndex = -1;
  for (const checkpoint of required) {
    const index = transitions.findIndex((transition) => transition.checkpoint === checkpoint);
    if (index < 0)
      throw new Error(`${scenario.scenarioId} lacks required checkpoint ${checkpoint}.`);
    if (index <= previousIndex)
      throw new Error(`${scenario.scenarioId} checkpoint ${checkpoint} is out of order.`);
    previousIndex = index;
  }
  for (const transition of transitions) {
    const missing = DETAILED_TRANSITION_FIELDS.filter(
      (field) => transition[field] === undefined || transition[field] === null,
    );
    if (missing.length)
      throw new Error(
        `${scenario.scenarioId} checkpoint ${transition.checkpoint ?? 'unknown'} lacks ${missing.join(', ')}.`,
      );
    if (!transition.authorizedActors.length || !transition.interaction?.requestFields?.length)
      throw new Error(
        `${scenario.scenarioId} checkpoint ${transition.checkpoint} lacks authorized actors or required interaction fields.`,
      );
    const visibilityKeys = Object.keys(transition.visibility ?? {}).sort();
    if (
      JSON.stringify(visibilityKeys) !==
      JSON.stringify(['Admin', 'Captain', 'Customer', 'Merchant'])
    )
      throw new Error(
        `${scenario.scenarioId} checkpoint ${transition.checkpoint} lacks explicit cross-app visibility.`,
      );
    if (!scenario.errorCodes.some((code) => transition.failureResult.includes(code)))
      throw new Error(
        `${scenario.scenarioId} checkpoint ${transition.checkpoint} lacks a stable failure result.`,
      );
    if (
      transition.businessDecisionRefs.some(
        (decision) => !scenario.businessDecisionRefs.includes(decision),
      )
    )
      throw new Error(
        `${scenario.scenarioId} checkpoint ${transition.checkpoint} has an undeclared business-decision blocker.`,
      );
  }
};

export function validateSemanticCatalog({ contracts, scenarios }) {
  const contractsById = new Map(contracts.map((contract) => [contract.contractId, contract]));
  const fingerprints = new Map();
  for (const scenario of scenarios) {
    const contract = contractsById.get(scenario.contractIds?.[0]);
    if (!contract)
      throw new Error(`${scenario.scenarioId} has no contract available for semantic validation.`);
    const label = `${contract.contractId} ${contract.title}`;
    if (/guest browsing/i.test(label) && hasAuthenticatedPrecondition(scenario))
      throw new Error(`Guest browsing has an authenticated precondition: ${scenario.scenarioId}`);
    if (
      /(?:mobile authentication|otp)/i.test(label) &&
      /otp\/requests/i.test(scenario.apiRequest?.path ?? '') &&
      hasAuthenticatedPrecondition(scenario)
    )
      throw new Error(`OTP initiation has an authenticated precondition: ${scenario.scenarioId}`);
    if (/\/v1\/contracts\//i.test(scenario.apiRequest?.path ?? ''))
      throw new Error(`Placeholder endpoint in ${scenario.scenarioId}`);
    if (/owning .*e2e role|\be2e (?:actor|role|user)\b/i.test(textOf(scenario.actors)))
      throw new Error(`Artificial actor in ${scenario.scenarioId}`);
    if (
      scenario.apiRequest?.method === 'GET' &&
      /persist(?:ed|s)? exactly once|insert(?:ed)?|updated? row|business mutation/i.test(
        scenario.databaseInvariant ?? '',
      )
    )
      throw new Error(`Read-only GET uses persistence semantics in ${scenario.scenarioId}`);
    for (const [name, requirement] of Object.entries(scenario.applicability ?? {})) {
      if (!['applicable', 'not-applicable', 'blocked'].includes(requirement?.status))
        throw new Error(`${scenario.scenarioId} has unexplained ${name} applicability.`);
      if (
        typeof requirement.reason !== 'string' ||
        requirement.reason.length < 20 ||
        /applies? where applicable|as applicable|if applicable|generic requirement/i.test(
          requirement.reason,
        )
      )
        throw new Error(`Generic applicability for ${name} in ${scenario.scenarioId}`);
    }
    if (scenario.priority === 'P0-launch') {
      const actors = scenario.actors ?? {};
      if (
        !actors.initiators?.length ||
        !actors.allowed?.length ||
        !actors.denied?.length ||
        !scenario.stateTransitions?.length ||
        !scenario.errorCodes?.length ||
        !scenario.featureBehavior?.length
      )
        throw new Error(
          `Launch scenario lacks real actors, state, errors, or feature behavior: ${scenario.scenarioId}`,
        );
      if (!scenario.evidenceRequiredToActivate?.length)
        throw new Error(`Launch scenario lacks activation evidence: ${scenario.scenarioId}`);
    }
    validateMultiStageLifecycle(scenario, contract);
    const fingerprint = JSON.stringify({
      actors: scenario.actors,
      given: scenario.given,
      when: scenario.when,
      then: scenario.then,
      stateTransitions: scenario.stateTransitions,
      apiRequest: scenario.apiRequest,
      apiResponse: scenario.apiResponse,
      errorCodes: scenario.errorCodes,
      databaseInvariant: scenario.databaseInvariant,
      applicability: scenario.applicability,
      featureBehavior: scenario.featureBehavior,
    });
    const previous = fingerprints.get(fingerprint);
    if (previous && previous.domain !== contract.domain)
      throw new Error(
        `Duplicated semantic boilerplate across unrelated contracts: ${previous.id} and ${scenario.scenarioId}`,
      );
    fingerprints.set(fingerprint, { id: scenario.scenarioId, domain: contract.domain });
  }
  return { semanticScenarioCount: scenarios.length };
}

export function validateScenarios(root = DEFAULT_ROOT) {
  const directory = join(root, 'contracts/scenarios');
  const schema = JSON.parse(readFileSync(join(directory, 'scenario.schema.json'), 'utf8'));
  const registry = JSON.parse(
    readFileSync(join(root, 'contracts/registry/contracts.json'), 'utf8'),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  let count = 0;
  const ids = new Set();
  const scenarios = [];
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
      scenarios.push(scenario);
      count += 1;
    }
  }
  const semantic = validateSemanticCatalog({ contracts: registry.contracts, scenarios });
  return { scenarioCount: count, semanticScenarioCount: semantic.semanticScenarioCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const result = validateScenarios(resolve(rootIndex >= 0 ? args[rootIndex + 1] : DEFAULT_ROOT));
  console.log(`Scenario catalogs valid: ${result.scenarioCount} planned scenarios.`);
}
