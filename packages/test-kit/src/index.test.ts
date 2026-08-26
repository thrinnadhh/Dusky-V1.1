import { describe, expect, it } from 'vitest';
import { createDeterministicFixture, FakePaymentAdapter } from './index';

describe('deterministic test kit', () => {
  it('replays the same clock, UUID, and identity', () => {
    const a = createDeterministicFixture();
    const b = createDeterministicFixture();
    expect(a).toEqual(b);
  });

  it('records fake provider calls without outbound traffic', async () => {
    const adapter = new FakePaymentAdapter();
    await adapter.authorize('payment-fixed', 1299);
    expect(adapter.calls).toEqual([{ paymentId: 'payment-fixed', amountMinor: 1299 }]);
  });
});

