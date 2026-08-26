import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const registry = json('contracts/registry/contracts.json');
const planned = registry.contracts.filter(({ status }) => status === 'planned');
const domains = {
  Customer: [22, 20],
  Merchant: [19, 16],
  Captain: [15, 14],
  Admin: [15, 12],
  Backend: [18, 16],
  E2E: [10, 10],
};
const scenarios = Object.keys(domains).flatMap(
  (domain) => json(`contracts/scenarios/${domain.toLowerCase()}.json`).scenarios,
);

test('catalog has the exact planned domain and launch-critical counts', () => {
  assert.equal(registry.contracts.length, 110);
  assert.equal(planned.length, 99);
  assert.equal(planned.filter(({ criticality }) => criticality === 'launch-critical').length, 88);
  for (const [domain, [count, launch]] of Object.entries(domains)) {
    const contracts = planned.filter((contract) => contract.domain === domain);
    assert.equal(contracts.length, count, `${domain} contract count`);
    assert.equal(
      contracts.filter(({ criticality }) => criticality === 'launch-critical').length,
      launch,
      `${domain} launch count`,
    );
  }
});

test('every planned contract has real actors, interactions, state, errors, policies, and tests', () => {
  for (const contract of planned) {
    assert.ok(contract.actors.initiators.length, contract.contractId);
    assert.ok(contract.actors.denied.length, contract.contractId);
    assert.ok(contract.stateTransitions.length, contract.contractId);
    assert.ok(contract.errorCodes.length, contract.contractId);
    assert.ok(contract.interactions.length, contract.contractId);
    for (const interaction of contract.interactions) {
      assert.ok(interaction.requestFields.length, contract.contractId);
      assert.ok(interaction.responseFields.length, contract.contractId);
      if (interaction.kind === 'http') {
        assert.match(interaction.path, /^\/api\/v1\//, contract.contractId);
        assert.doesNotMatch(interaction.path, /\/contracts\//, contract.contractId);
      } else assert.ok(interaction.interface, contract.contractId);
    }
    for (const requirement of Object.values(contract.applicability)) {
      assert.match(requirement.status, /^(applicable|not-applicable|blocked)$/);
      assert.ok(requirement.reason.length >= 20, contract.contractId);
    }
    for (const layer of ['unit', 'component', 'integration', 'contract', 'e2e'])
      assert.ok(contract.testExpectations[layer].length, `${contract.contractId}:${layer}`);
    assert.ok(contract.activationEvidence.length >= 3, contract.contractId);
  }
});

test('scenario semantics remain bounded to the matching feature in every domain', () => {
  assert.equal(scenarios.length, 99);
  const contractIds = new Set(planned.map(({ contractId }) => contractId));
  for (const scenario of scenarios) {
    assert.ok(contractIds.has(scenario.contractIds[0]), scenario.scenarioId);
    assert.ok(scenario.actors.initiators.length, scenario.scenarioId);
    assert.ok(scenario.actors.allowed.length, scenario.scenarioId);
    assert.ok(scenario.actors.denied.length, scenario.scenarioId);
    assert.ok(scenario.featureBehavior.length >= 2, scenario.scenarioId);
    if (scenario.apiRequest.method === 'GET')
      assert.doesNotMatch(
        scenario.databaseInvariant,
        /persisted exactly once|inserted row|business mutation/i,
        scenario.scenarioId,
      );
  }
  for (const representative of [
    'SCN-CUS-DISC-001',
    'SCN-MER-INV-001',
    'SCN-CAP-CON-001',
    'SCN-ADM-RBAC-001',
    'SCN-BE-PAY-001',
    'SCN-E2E-ORDER-001',
  ])
    assert.ok(
      scenarios.some(({ scenarioId }) => scenarioId === representative),
      representative,
    );
});

test('guest and decision-dependent behavior is represented explicitly', () => {
  const guest = planned.find(({ contractId }) => contractId === 'CUS-DISC-001');
  assert.deepEqual(guest.actors.guest, ['guest customer']);
  assert.ok(guest.actors.authenticated.length === 0);
  const otp = planned.find(({ contractId }) => contractId === 'CUS-AUTH-001');
  assert.deepEqual(otp.actors.initiators, ['unauthenticated customer']);
  assert.doesNotMatch(otp.preconditions.join(' '), /authenticated customer.*(?:exists|signed in)/i);
  const decisions = new Set(planned.flatMap(({ businessDecisionRefs }) => businessDecisionRefs));
  assert.deepEqual([...decisions].sort(), [
    'BD-001',
    'BD-002',
    'BD-003',
    'BD-004',
    'BD-005',
    'BD-006',
    'BD-007',
    'BD-008',
    'BD-009',
    'BD-010',
  ]);
  for (const contract of planned.filter(({ businessDecisionRefs }) => businessDecisionRefs.length))
    assert.equal(contract.applicability.businessDecision.status, 'blocked', contract.contractId);
});
