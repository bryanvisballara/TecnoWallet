import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CardPaymentProvider,
  type ProviderPaymentResult,
} from './payment-provider';

/**
 * Stub for a future USA card acquiring provider (Stripe/Adyen/etc.).
 * Unit debit cards are issuance/spend products — not merchant card charging.
 * Recaudos must not call this directly; route through PaymentOrchestration.
 */
@Injectable()
export class UnconfiguredCardPaymentProvider extends CardPaymentProvider {
  readonly name = 'card' as const;

  chargeCard(): Promise<ProviderPaymentResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'CardPaymentProvider is not configured. Integrate a card acquirer without changing Recaudos.',
      ),
    );
  }
}
