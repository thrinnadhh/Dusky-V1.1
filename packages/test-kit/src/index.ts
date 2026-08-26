export interface DeterministicFixture {
  now: string;
  uuid: string;
  identity: { userId: string; role: 'customer'; tenantId: string };
}

export function createDeterministicFixture(): DeterministicFixture {
  return {
    now: '2026-01-01T00:00:00.000Z',
    uuid: '00000000-0000-4000-8000-000000000001',
    identity: { userId: 'customer-fixed', role: 'customer', tenantId: 'tenant-fixed' },
  };
}

export interface PaymentCall {
  paymentId: string;
  amountMinor: number;
}

export class FakePaymentAdapter {
  readonly calls: PaymentCall[] = [];

  async authorize(paymentId: string, amountMinor: number): Promise<{ status: 'authorized' }> {
    this.calls.push({ paymentId, amountMinor });
    return Promise.resolve({ status: 'authorized' });
  }
}

export class FakeMessageAdapter {
  readonly calls: Array<{ destination: string; payload: string }> = [];

  async send(destination: string, payload: string): Promise<void> {
    this.calls.push({ destination, payload });
  }
}

export class FakeStorageAdapter {
  private readonly values = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }
}

