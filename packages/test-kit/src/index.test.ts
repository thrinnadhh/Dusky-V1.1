import { describe, expect, it } from 'vitest';
import {
  createDeterministicFixture,
  FakeMessageAdapter,
  FakePaymentAdapter,
  FakeStorageAdapter,
} from './index';

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

  it('records messaging and storage operations in memory', async () => {
    const messaging = new FakeMessageAdapter();
    const storage = new FakeStorageAdapter();
    await messaging.send('customer-fixed', 'order-updated');
    await storage.put('receipt-fixed', 'stored');
    expect(messaging.calls).toEqual([{ destination: 'customer-fixed', payload: 'order-updated' }]);
    expect(await storage.get('receipt-fixed')).toBe('stored');
    expect(await storage.get('missing')).toBeUndefined();
  });
});
