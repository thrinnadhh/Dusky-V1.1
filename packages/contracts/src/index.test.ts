import { describe, expect, it } from 'vitest';
import { ApiErrorEnvelopeSchema, ContractReferenceSchema } from './index';

describe('shared active contracts', () => {
  it('accepts the standardized API error envelope', () => {
    expect(
      ApiErrorEnvelopeSchema.parse({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', traceId: 'trace-fixed' },
      }),
    ).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', traceId: 'trace-fixed' },
    });
  });

  it('rejects malformed contract identifiers', () => {
    expect(() =>
      ContractReferenceSchema.parse({ contractId: 'not namespaced', version: '1.0.0' }),
    ).toThrow();
  });
});
