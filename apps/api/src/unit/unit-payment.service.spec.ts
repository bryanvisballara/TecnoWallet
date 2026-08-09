import { mapUnitPaymentStatus } from './unit-payment.service';

describe('mapUnitPaymentStatus', () => {
  it('maps Unit ACH statuses to PaymentIntent statuses', () => {
    expect(mapUnitPaymentStatus('Pending')).toBe('pending');
    expect(mapUnitPaymentStatus('Clearing')).toBe('clearing');
    expect(mapUnitPaymentStatus('Sent')).toBe('sent');
    expect(mapUnitPaymentStatus('Returned')).toBe('returned');
    expect(mapUnitPaymentStatus('Canceled')).toBe('canceled');
    expect(mapUnitPaymentStatus('Rejected')).toBe('rejected');
  });
});
