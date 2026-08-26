import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateActiveContractProtection,
  validateReciprocalProvenance,
} from './validate-contracts.mjs';

const reciprocalFixture = () => ({
  contracts: [
    {
      contractId: 'CUS-PROV-001',
      provenance: { legacyTestIds: ['LEG-001'], greenfieldRationale: null },
    },
  ],
  inventory: {
    tests: [
      {
        legacyTestId: 'LEG-001',
        sourceRepository: 'Mypetnew',
        sourceSha: '817c6487cdbf18fc282dc0a44538d83e7bc5ef8b',
        sourcePath: 'apps/customer-app/src/__tests__/catalog.test.ts',
        sourceFileSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        evidenceScope: 'pinned-public-ci-verifiable',
        disposition: 'mapped',
        dispositionEvidence: 'Catalog discovery behavior is retained.',
        mappingRuleId: 'TEST-CATALOG-DISCOVERY',
        mappingResolutionReason:
          'Selected explicit test fixture mapping rule for reciprocal provenance validation.',
        targetDuskyContractIds: ['CUS-PROV-001'],
      },
    ],
  },
  manifest: {
    sourceSha: '817c6487cdbf18fc282dc0a44538d83e7bc5ef8b',
    publicEvidence: {
      files: [
        {
          path: 'apps/customer-app/src/__tests__/catalog.test.ts',
          sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
    },
    localEvidence: [],
  },
});

test('accepts reciprocal exact-ID provenance and a justified greenfield contract', () => {
  const fixture = reciprocalFixture();
  fixture.contracts.push({
    contractId: 'CUS-NEW-001',
    provenance: {
      legacyTestIds: [],
      greenfieldRationale: 'No legacy test covers the new bounded capability.',
    },
  });
  assert.equal(validateReciprocalProvenance(fixture).reciprocalLegacyIdCount, 1);
});

test('rejects missing IDs, one-way mappings, generic file provenance, and absolute paths', () => {
  const missing = reciprocalFixture();
  missing.contracts[0].provenance.legacyTestIds = ['LEG-MISSING'];
  assert.throws(() => validateReciprocalProvenance(missing), /missing legacy test ID/i);

  const forwardOnly = reciprocalFixture();
  forwardOnly.inventory.tests[0].targetDuskyContractIds = [];
  assert.throws(() => validateReciprocalProvenance(forwardOnly), /does not map back/i);

  const reverseOnly = reciprocalFixture();
  reverseOnly.contracts[0].provenance.legacyTestIds = [];
  reverseOnly.contracts[0].provenance.greenfieldRationale = 'Incorrectly declared greenfield.';
  assert.throws(
    () => validateReciprocalProvenance(reverseOnly),
    /missing reciprocal contract reference/i,
  );

  const generic = reciprocalFixture();
  generic.contracts[0] = {
    contractId: 'CUS-PROV-001',
    legacyProvenance: [{ sourcePath: 'contracts/legacy/MYPETNEW_TEST_INVENTORY.json' }],
  };
  assert.throws(() => validateReciprocalProvenance(generic), /generic inventory file/i);

  const absolute = reciprocalFixture();
  absolute.inventory.tests[0].sourcePath = '/Users/example/Mypetnew/catalog.test.ts';
  assert.throws(() => validateReciprocalProvenance(absolute), /absolute workstation path/i);
});

const baseRegistry = () => ({
  contracts: [
    {
      contractId: 'FOUND-CI-001',
      status: 'active',
      version: '1.2.0',
      successBehavior: ['All required gates execute and propagate failure.'],
      errorBehavior: ['A failed gate returns a non-zero exit code.'],
      executableTestPaths: ['scripts/validate-test-integrity.test.mjs'],
    },
  ],
});

test('protects base-active contracts even when the editable baseline is weakened too', () => {
  const base = baseRegistry();
  const deleted = { contracts: [] };
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: base,
        currentRegistry: deleted,
        exceptions: { exceptions: [] },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /base-active contract.*deleted/i,
  );

  const downgraded = baseRegistry();
  downgraded.contracts[0].status = 'planned';
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: base,
        currentRegistry: downgraded,
        exceptions: { exceptions: [] },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /base-active contract.*downgraded/i,
  );
});

test('rejects active version regression, silent weakening, and malformed blanket exceptions', () => {
  const base = baseRegistry();
  const regressed = baseRegistry();
  regressed.contracts[0].version = '1.1.9';
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: base,
        currentRegistry: regressed,
        exceptions: { exceptions: [] },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /version regression/i,
  );

  const weakened = baseRegistry();
  weakened.contracts[0].errorBehavior = [];
  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: base,
        currentRegistry: weakened,
        exceptions: { exceptions: [] },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /silent weakening|semantic change/i,
  );

  assert.throws(
    () =>
      validateActiveContractProtection({
        baseRegistry: base,
        currentRegistry: weakened,
        exceptions: {
          exceptions: [
            {
              id: 'EX-ALL',
              contractId: '*',
              changeType: 'anything',
              reason: 'blanket bypass',
              owner: 'nobody',
              migrationPlan: 'none',
              expiresAt: '2099-01-01T00:00:00Z',
              userAuthorizationReference: '',
            },
          ],
        },
        now: new Date('2026-08-26T00:00:00Z'),
      }),
    /malformed|blanket|authorization/i,
  );
});
