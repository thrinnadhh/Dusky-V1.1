import { z } from 'zod';

export const ContractIdSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}$/);

export const ContractReferenceSchema = z.object({
  contractId: ContractIdSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    traceId: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
export type ContractReference = z.infer<typeof ContractReferenceSchema>;

export const ACTIVE_FOUNDATION_CONTRACTS = {
  customer: ContractReferenceSchema.parse({ contractId: 'FOUND-APP-CUS-001', version: '1.0.0' }),
  merchant: ContractReferenceSchema.parse({ contractId: 'FOUND-APP-MER-001', version: '1.0.0' }),
  captain: ContractReferenceSchema.parse({ contractId: 'FOUND-APP-CAP-001', version: '1.0.0' }),
  admin: ContractReferenceSchema.parse({ contractId: 'FOUND-APP-ADM-001', version: '1.0.0' }),
} as const;

