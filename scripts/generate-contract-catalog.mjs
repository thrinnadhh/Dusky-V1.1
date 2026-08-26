import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { domainOwnership, launchCritical, plannedDefinitions } from './contract-catalog-source.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const inventory = JSON.parse(
  readFileSync(join(root, 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json'), 'utf8'),
);

const activeDefinitions = [
  [
    'FOUND-APP-CUS-001',
    'Customer application bootstrap',
    'Customer',
    ['apps/customer-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-MER-001',
    'Merchant application bootstrap',
    'Merchant',
    ['apps/merchant-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-CAP-001',
    'Captain application bootstrap',
    'Captain',
    ['apps/captain-app/src/App.test.tsx'],
  ],
  [
    'FOUND-APP-ADM-001',
    'Admin application bootstrap',
    'Admin',
    ['apps/admin-web/src/page.test.tsx'],
  ],
  [
    'FOUND-BE-HEALTH-001',
    'Backend health and readiness',
    'Backend',
    ['backend/src/test/kotlin/in/dusky/foundation/FoundationApplicationTest.kt'],
  ],
  [
    'FOUND-BE-ERROR-001',
    'Standard API error envelope',
    'Backend',
    [
      'backend/src/test/kotlin/in/dusky/foundation/FoundationApplicationTest.kt',
      'packages/contracts/src/index.test.ts',
    ],
  ],
  [
    'FOUND-DB-001',
    'PostgreSQL integration harness',
    'Backend',
    ['backend/src/test/kotlin/in/dusky/foundation/PostgresFoundationTest.kt'],
  ],
  ['FOUND-CON-001', 'Shared contract schemas', 'E2E', ['packages/contracts/src/index.test.ts']],
  [
    'FOUND-FIX-001',
    'Deterministic fixtures and fake providers',
    'E2E',
    ['packages/test-kit/src/index.test.ts'],
  ],
  [
    'FOUND-REG-001',
    'Contract and scenario registry validation',
    'E2E',
    ['scripts/validate-contracts.test.mjs'],
  ],
  [
    'FOUND-CI-001',
    'Test integrity and repository policy',
    'E2E',
    ['scripts/validate-test-integrity.test.mjs', 'scripts/validate-repository.test.mjs'],
  ],
];

const unique = (values) => [...new Set(values)];
const participantsFor = (definition) => {
  if (definition.actors?.length) return unique(definition.actors);
  if (definition.actor === 'guest or authenticated customer')
    return ['guest customer', 'authenticated customer'];
  return [definition.actor];
};
const requirement = (status, reason, behavior = [], decisionRefs = []) => ({
  status,
  reason,
  behavior: unique(behavior),
  decisionRefs: unique(decisionRefs),
});

const provenanceFor = (contractId, title) => {
  const legacyTestIds = inventory.tests
    .filter((entry) => entry.targetDuskyContractIds?.includes(contractId))
    .map(({ legacyTestId }) => legacyTestId)
    .sort();
  return {
    legacyTestIds,
    greenfieldRationale: legacyTestIds.length
      ? null
      : `No mapped MyPetNew test ID covers ${title}; this bounded capability is specified as greenfield behavior.`,
  };
};

const isReadOnly = (definition) =>
  definition.mutation === false ||
  definition.interactions.every(
    (interaction) => interaction.kind === 'http' && interaction.method === 'GET',
  );

const actorsFor = (definition, domain) => {
  const participants = participantsFor(definition);
  const guest = definition.guest
    ? participants.filter((actor) => /guest|unauthenticated/i.test(actor))
    : [];
  const authenticated = participants.filter(
    (actor) => !/^(?:guest|unauthenticated)\b/i.test(actor),
  );
  return {
    initiators: participants,
    public: definition.public ? participants : [],
    guest,
    authenticated,
    privileged:
      definition.privileged || domain === 'Admin'
        ? [definition.actor]
        : participants.filter((actor) => /admin|operator|manager|worker|provider/i.test(actor)),
    denied: unique([
      `revoked or suspended ${definition.actor}`,
      `actor outside ${definition.scope}`,
      `actor presenting a resource outside ${definition.scope}`,
    ]),
  };
};

const interactionTrigger = (interaction) =>
  interaction.kind === 'http'
    ? `${interaction.method} ${interaction.path} completes ${interaction.operation}`
    : `${interaction.interface} completes ${interaction.operation}`;

const applicabilityFor = (definition, domain) => {
  const readOnly = isReadOnly(definition);
  const decisionRefs = definition.decisions ?? [];
  const idempotency = readOnly
    ? requirement(
        'not-applicable',
        `${definition.title} observes ${definition.resource} without creating or changing a business result.`,
      )
    : requirement(
        'applicable',
        `${definition.title} can change ${definition.resource}, so retry identity must be stable for the initiating actor.`,
        [
          `Bind an idempotency key to ${definition.actor}, the operation, and the canonical request payload.`,
          `Return the original ${definition.resource} result for an exact replay and reject a changed payload.`,
        ],
      );
  const concurrencyBehavior = definition.concurrency
    ? [definition.concurrency]
    : readOnly
      ? [
          `Read ${definition.resource} from one committed snapshot and discard stale client responses.`,
        ]
      : [
          `Serialize the transition from ${definition.state[0]} to ${definition.state[1]} and return the winner's version.`,
        ];
  const auditApplicable = !readOnly || definition.privileged || domain === 'Admin';
  return {
    idempotency,
    concurrency: requirement(
      'applicable',
      readOnly
        ? `${definition.title} must not combine incompatible versions of ${definition.resource} in one response.`
        : `${definition.title} has a state boundary where simultaneous commands could otherwise conflict.`,
      concurrencyBehavior,
    ),
    offlineRetry: requirement(
      'applicable',
      `${definition.title} has an explicit connectivity and reconnect rule for ${definition.resource}.`,
      [
        definition.offline ??
          `Do not assume an offline mutation; retry only after reloading ${definition.resource}.`,
      ],
    ),
    observability: requirement(
      'applicable',
      `${definition.title} needs a diagnosable outcome without exposing credentials or private resource data.`,
      [
        `Emit ${definition.contractId}, the operation, actor class, outcome code, trace ID, and latency.`,
        `Redact credentials and private fields of ${definition.resource}.`,
      ],
    ),
    audit: auditApplicable
      ? requirement(
          'applicable',
          `${definition.title} changes state or exercises privileged authority over ${definition.resource}.`,
          [
            `Record actor, scope, before/after version, outcome, and trace ID for ${definition.resource}.`,
          ],
        )
      : requirement(
          'not-applicable',
          `${definition.title} is an ordinary non-privileged read and does not create a business audit event.`,
          [
            `Operational access logs still follow the observability rule for ${definition.contractId}.`,
          ],
        ),
    accessibility:
      domain === 'Backend'
        ? requirement(
            'not-applicable',
            `${definition.title} is backend-only; visual and assistive-technology interaction is owned by consuming clients.`,
            [
              `Expose stable fields, errors, correlation IDs, and operational diagnostics that clients can present accessibly.`,
            ],
          )
        : requirement(
            'applicable',
            `${definition.title} has a user-visible state that must work with keyboard, screen reader, text scaling, and non-color cues.`,
            [
              `Label controls and ${definition.resource} status, preserve logical focus, and announce errors and recovery.`,
            ],
          ),
    businessDecision: decisionRefs.length
      ? requirement(
          'blocked',
          `${definition.title} contains a bounded policy portion that cannot be finalized until the referenced decisions are authorized.`,
          [
            `Keep the decision-dependent portion disabled while implementing only behavior independent of ${decisionRefs.join(', ')}.`,
          ],
          decisionRefs,
        )
      : requirement(
          'not-applicable',
          `${definition.title} does not depend on an unresolved business decision in the P0 catalog.`,
        ),
  };
};

const testsFor = (definition, domain) => ({
  unit: [
    `Exercise ${definition.title} boundaries, ${definition.errorCodes.join(', ')}, and the ${definition.state[0]} to ${definition.state[1]} decision.`,
  ],
  component: [
    domain === 'Backend'
      ? `Exercise the ${definition.interactions[0].operation} service component with authorized, denied, stale, and failure inputs.`
      : `Render ${definition.title} loading, success, empty, denied, stale, offline, and recovery states with accessible semantics.`,
  ],
  integration: [
    `Verify ${definition.resource} ownership, the state transition, and database invariants against PostgreSQL and deterministic providers.`,
  ],
  contract: [
    `Validate ${definition.interactions.map((interaction) => interaction.operation).join(' and ')} fields, stable errors, authorization, and applicability rules.`,
  ],
  e2e: [
    domain === 'E2E'
      ? `Drive ${definition.actors.join(', ')} through ${definition.title} and verify the authoritative result at every consumer.`
      : `Drive ${definition.actor} through ${definition.title} and verify the resulting ${definition.resource} projection.`,
  ],
});

const contractFor = (domain, definition) => {
  const ownership = domainOwnership[domain];
  const readOnly = isReadOnly(definition);
  const actors = actorsFor(definition, domain);
  const authorization = {
    allowed: participantsFor(definition),
    denied: actors.denied,
    ownershipRules: [
      `Authorize ${definition.scope} on the server before reading or changing ${definition.resource}.`,
      `Reject cross-role, cross-tenant, cross-outlet, or foreign-resource identifiers without revealing existence.`,
    ],
  };
  const transitionDefinitions = definition.lifecycleTransitions ??
    definition.transitions ?? [
      {
        from: definition.state[0],
        to: definition.state[1],
        interactionIndex: 0,
        readOnly,
      },
    ];
  const stateTransitions = definition.lifecycleTransitions
    ? transitionDefinitions.map((transition) => ({
        ...transition,
        trigger: interactionTrigger(transition.interaction),
      }))
    : transitionDefinitions.map((transition) => ({
        from: transition.from,
        to: transition.to,
        trigger: interactionTrigger(definition.interactions[transition.interactionIndex]),
      }));
  const databaseInvariants = definition.lifecycleTransitions
    ? transitionDefinitions.map(({ databaseInvariant }) => databaseInvariant)
    : transitionDefinitions.map((transition) =>
        (transition.readOnly ?? readOnly)
          ? `${definition.interactions[transition.interactionIndex].operation} does not mutate ${definition.resource}; it reads ${definition.scope} from one committed snapshot.`
          : `The ${transition.from} to ${transition.to} transition, ownership checks, and audit or outbox record for ${definition.resource} commit atomically.`,
      );
  return {
    contractId: definition.contractId,
    title: definition.title,
    domain,
    description: `${definition.title} governs ${definition.resource}; ${definition.success}`,
    producer: ownership.producer,
    consumers: ownership.consumers,
    owningModule: ownership.owningModule,
    status: 'planned',
    criticality: launchCritical(definition.contractId) ? 'launch-critical' : 'high',
    version: '2.0.0',
    actors,
    preconditions: unique([
      definition.precondition ??
        (definition.guest
          ? `${definition.actor} supplies the required input; no authenticated session is assumed.`
          : `${definition.actor} has a current server-verified identity authorized for ${definition.scope}.`),
      `${definition.state[0]} is the authoritative starting state for ${definition.resource}.`,
    ]),
    successBehavior: unique([
      definition.success,
      `Return only the fields declared by ${definition.interactions.map((interaction) => interaction.operation).join(' and ')} for ${definition.scope}.`,
    ]),
    errorBehavior: definition.errorCodes.map(
      (code) =>
        `${code} returns the standard error envelope and leaves ${definition.resource} at its last committed version.`,
    ),
    stateTransitions,
    databaseInvariants,
    interactions: definition.interactions,
    errorCodes: definition.errorCodes,
    authorization,
    tenantOutletIsolation: [
      `Scope every ${definition.resource} ${readOnly ? 'read' : 'read or write'} to ${definition.scope}.`,
      `A foreign identifier is denied before any ${definition.resource} data is disclosed or mutated.`,
    ],
    applicability: applicabilityFor(definition, domain),
    businessDecisionRefs: definition.decisions ?? [],
    provenance: provenanceFor(definition.contractId, definition.title),
    plannedImplementationWorkstream: `${domain.toLowerCase()}-${definition.contractId.toLowerCase()}`,
    requiredTestLayers: ['unit', 'component', 'integration', 'contract', 'e2e'],
    testExpectations: testsFor(definition, domain),
    activationEvidence: unique([
      `Production paths implementing ${definition.interactions.map((interaction) => interaction.operation).join(' and ')}.`,
      `Executable tests for ${definition.contractId} at every required layer with no skips, focus, todo, or placeholders.`,
      `Authorization, ${definition.errorCodes.join(', ')}, state, retry, and concurrency evidence at the exact implementation SHA.`,
      ...(definition.decisions?.length
        ? [
            `User authorization resolving ${definition.decisions.join(', ')} before the blocked policy portion is activated.`,
          ]
        : []),
    ]),
    executableTestPaths: [],
  };
};

const plannedContracts = Object.entries(plannedDefinitions).flatMap(([domain, definitions]) =>
  definitions.map((definition) => contractFor(domain, definition)),
);

const activeContractFor = ([contractId, title, domain, executableTestPaths]) => {
  const ownership = domainOwnership[domain];
  const interfaceName = `Foundation.${contractId.replaceAll('-', '_')}.verify`;
  const isUi =
    domain !== 'Backend' &&
    !['FOUND-CON-001', 'FOUND-FIX-001', 'FOUND-REG-001', 'FOUND-CI-001'].includes(contractId);
  return {
    contractId,
    title,
    domain,
    description: `${title} is an implemented P0 foundation capability with executable evidence and no production business behavior.`,
    producer: ownership.producer,
    consumers: ownership.consumers,
    owningModule: ownership.owningModule,
    status: 'active',
    criticality: 'foundation',
    version: '2.0.0',
    actors: {
      initiators: ['CI runner or local repository validator'],
      public: [],
      guest: [],
      authenticated: ['repository maintainer'],
      privileged: ['CI runner'],
      denied: [
        'process attempting to inject production credentials',
        'process outside the checked-out repository',
      ],
    },
    preconditions: [
      'The repository is installed from the frozen lockfile.',
      'Validation runs against one exact Git SHA.',
    ],
    successBehavior: [
      `${title} passes every executable foundation test and emits a non-zero exit code on failure.`,
    ],
    errorBehavior: [
      `FOUNDATION_VALIDATION_FAILED identifies a missing module, malformed configuration, or failed ${title} test.`,
    ],
    stateTransitions: [
      {
        from: 'foundation unchecked',
        to: 'foundation evidence verified',
        trigger: `${interfaceName} completes successfully`,
      },
    ],
    databaseInvariants: ['Foundation validation never reads or mutates production business data.'],
    interactions: [
      {
        kind: 'internal',
        operation: `verify ${title.toLowerCase()}`,
        interface: interfaceName,
        requestFields: ['repositorySha'],
        responseFields: ['exitCode', 'evidencePaths'],
      },
    ],
    errorCodes: ['FOUNDATION_VALIDATION_FAILED'],
    authorization: {
      allowed: ['CI runner or local repository validator'],
      denied: ['process with production credentials or deployment authority'],
      ownershipRules: ['Operate only on files in the exact checked-out repository SHA.'],
    },
    tenantOutletIsolation: [
      'No tenant, outlet, customer, merchant, captain, order, appointment, or payment data exists in foundation fixtures.',
    ],
    applicability: {
      idempotency: requirement(
        'applicable',
        `${title} must be deterministic when repeated at the same repository SHA.`,
        ['Return the same pass or failure outcome for unchanged inputs.'],
      ),
      concurrency: requirement(
        'applicable',
        `${title} may execute beside independent CI jobs without shared mutable business state.`,
        ['Keep reports job-local and read repository inputs without mutation.'],
      ),
      offlineRetry: requirement(
        'applicable',
        `${title} can be rerun after dependencies are available from the frozen lockfile.`,
        ['Do not deploy, contact production, or accept production credentials during retry.'],
      ),
      observability: requirement(
        'applicable',
        `${title} needs durable process and report evidence.`,
        ['Emit the exact SHA, command, exit code, and evidence paths.'],
      ),
      audit: requirement(
        'not-applicable',
        `${title} validates repository files and creates no privileged business audit event.`,
        ['Git and CI logs retain foundation validation evidence.'],
      ),
      accessibility: isUi
        ? requirement(
            'applicable',
            `${title} includes a visible bootstrap surface requiring semantic identity and announced failure.`,
            ['Expose an accessible application identity and bootstrap error state.'],
          )
        : requirement(
            'not-applicable',
            `${title} is non-visual foundation tooling whose usability is expressed through stable diagnostics.`,
            ['Emit readable diagnostics and machine-readable exit status.'],
          ),
      businessDecision: requirement(
        'not-applicable',
        `${title} implements no unresolved production business policy.`,
      ),
    },
    businessDecisionRefs: [],
    provenance: provenanceFor(contractId, title),
    plannedImplementationWorkstream: 'p0-foundation',
    requiredTestLayers: ['unit', 'integration'],
    testExpectations: {
      unit: [`Reject malformed or missing ${title} foundation inputs.`],
      component: [
        `Exercise the bounded ${title} foundation module without production dependencies.`,
      ],
      integration: [`Run ${title} from the repository validation entry point.`],
      contract: [`Keep ${interfaceName} input, output, and failure behavior stable.`],
      e2e: [`Exercise ${title} in the complete clean-checkout validation pipeline.`],
    },
    activationEvidence: [
      `Executable ${title} tests at the exact repository SHA.`,
      'A clean validation run with propagated failures and no skipped checks.',
    ],
    executableTestPaths,
  };
};

const activeContracts = activeDefinitions.map(activeContractFor);

const scenarioFor = (contract) => {
  const interaction = contract.interactions[0];
  const detailedLifecycle = contract.stateTransitions.every(({ checkpoint }) => checkpoint);
  const apiRequest = {
    kind: interaction.kind,
    operation: interaction.operation,
    ...(interaction.method ? { method: interaction.method } : {}),
    ...(interaction.path ? { path: interaction.path } : {}),
    ...(interaction.interface ? { interface: interaction.interface } : {}),
    fields: interaction.requestFields,
  };
  return {
    scenarioId: `SCN-${contract.contractId}`,
    contractIds: [contract.contractId],
    priority: contract.criticality === 'launch-critical' ? 'P0-launch' : 'P1',
    actors: {
      initiators: contract.actors.initiators,
      allowed: contract.authorization.allowed,
      denied: contract.authorization.denied,
    },
    given: contract.preconditions,
    when: detailedLifecycle
      ? contract.stateTransitions.map(
          (transition) =>
            `${transition.initiatingActor} executes ${transition.interaction.operation} for checkpoint ${transition.checkpoint} with ${transition.interaction.requestFields.join(', ')}.`,
        )
      : [
          `${contract.actors.initiators[0]} invokes ${interaction.operation} with ${interaction.requestFields.join(', ')}.`,
          `The producer authorizes ${contract.authorization.ownershipRules[0].toLowerCase()} and evaluates ${contract.errorCodes.join(', ')}.`,
        ],
    then: detailedLifecycle
      ? contract.stateTransitions.map(
          (transition) =>
            `${transition.checkpoint} moves ${transition.from} to ${transition.to} only for ${transition.authorizedActors.join(', ')}; otherwise ${transition.failureResult}`,
        )
      : unique([
          contract.successBehavior[0],
          contract.errorBehavior[0],
          `The observed state is ${contract.stateTransitions[0].to}; no cross-scope or partial result is visible.`,
        ]),
    stateTransitions: contract.stateTransitions,
    requiredFixtures: detailedLifecycle
      ? [
          `A versioned fixture for every ${contract.stateTransitions.map(({ checkpoint }) => checkpoint).join(', ')} checkpoint and branch.`,
          `Authorized and denied identities for ${unique(contract.stateTransitions.flatMap(({ authorizedActors }) => authorizedActors)).join(', ')}.`,
          `Deterministic correlation IDs, idempotency keys, clocks, provider outcomes, projection lag, and compensation outcomes.`,
        ]
      : [
          `${contract.stateTransitions[0].from} fixture for ${contract.title}`,
          `${contract.actors.initiators[0]} and denied cross-scope actor identities`,
          `deterministic ${contract.domain.toLowerCase()} clock, identifiers, and provider outcomes`,
        ],
    apiRequest,
    apiResponse: {
      fields: interaction.responseFields,
      errorEnvelope: '{ error: { code, message, traceId, details? } }',
    },
    errorCodes: contract.errorCodes,
    authorizationMatrix: contract.authorization,
    databaseInvariant: contract.databaseInvariants[0],
    applicability: {
      idempotency: contract.applicability.idempotency,
      concurrency: contract.applicability.concurrency,
      offlineRetry: contract.applicability.offlineRetry,
      audit: contract.applicability.audit,
      accessibility: contract.applicability.accessibility,
      businessDecision: contract.applicability.businessDecision,
    },
    observabilityExpectations: contract.applicability.observability.behavior,
    businessDecisionRefs: contract.businessDecisionRefs,
    featureBehavior: [
      contract.successBehavior[0],
      contract.tenantOutletIsolation[0],
      `${contract.title} exposes only ${interaction.responseFields.join(', ')} after ${interaction.operation}.`,
    ],
    requiredUnitTests: contract.testExpectations.unit,
    requiredComponentTests: contract.testExpectations.component,
    requiredIntegrationTests: contract.testExpectations.integration,
    requiredContractTests: contract.testExpectations.contract,
    requiredE2ETests: contract.testExpectations.e2e,
    evidenceRequiredToActivate: contract.activationEvidence,
  };
};

mkdirSync(join(root, 'contracts/registry'), { recursive: true });
mkdirSync(join(root, 'contracts/scenarios'), { recursive: true });
writeFileSync(
  join(root, 'contracts/registry/contracts.json'),
  `${JSON.stringify({ schemaVersion: '2.0.0', contracts: [...activeContracts, ...plannedContracts] }, null, 2)}\n`,
);
writeFileSync(
  join(root, 'contracts/registry/active-baseline.json'),
  `${JSON.stringify({ schemaVersion: '2.0.0', note: 'Convenience snapshot only; pull-request protection compares the actual base SHA.', activeContractIds: activeContracts.map(({ contractId }) => contractId) }, null, 2)}\n`,
);
writeFileSync(
  join(root, 'contracts/registry/breaking-change-exceptions.json'),
  `${JSON.stringify({ schemaVersion: '2.0.0', exceptions: [] }, null, 2)}\n`,
);
for (const domain of Object.keys(plannedDefinitions)) {
  const contracts = plannedContracts.filter((contract) => contract.domain === domain);
  writeFileSync(
    join(root, 'contracts/scenarios', `${domain.toLowerCase()}.json`),
    `${JSON.stringify({ schemaVersion: '2.0.0', application: domain, scenarios: contracts.map(scenarioFor) }, null, 2)}\n`,
  );
}

const launchCount = plannedContracts.filter(
  ({ criticality }) => criticality === 'launch-critical',
).length;
console.log(
  `Generated ${activeContracts.length + plannedContracts.length} contracts and ${plannedContracts.length} planned scenarios (${launchCount} launch-critical).`,
);
