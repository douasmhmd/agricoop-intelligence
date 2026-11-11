import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppProblem } from '@agricoop/nest-kit';
import { money, toMoneyString } from '@agricoop/shared';

/** A verified payment notification from the provider. */
export interface PaymentCallback {
  commandeId: string;
  /** Amount in MAD, canonical "123.45". */
  amount: string;
  approved: boolean;
  transactionId: string;
}

/**
 * Payment provider port. The MVP ships a CMI-style mock; a real CMI adapter implements the same
 * interface (hosted payment page + signed server-to-server callback).
 */
export interface PaymentGateway {
  readonly provider: string;
  /** Where the customer is sent to pay (relative to the storefront origin). */
  checkoutUrl(coopCode: string, commandeId: string): string;
  /** Verifies and parses a callback body. Throws AppProblem 400 `signature_invalide`. */
  parseCallback(coopCode: string, fields: Record<string, unknown>): PaymentCallback;
}

export const PAYMENT_GATEWAY = Symbol.for('agricoop.PAYMENT_GATEWAY');

/** ISO 4217 numeric code of MAD, as CMI sends it. */
export const MAD_CURRENCY = '504';

const invalidSignature = () =>
  new AppProblem(400, 'signature_invalide', 'Invalid payment callback', 'Signature check failed');

/**
 * CMI-style mock. Each cooperative is its own merchant with its own store key (derived here from one
 * secret). Callback fields: oid, amount, currency, Response (Approved | Declined), TransId, HASH where
 * HASH = base64(HMAC-SHA512(storeKey, "oid|amount|currency|Response|TransId")).
 */
export class CmiMockGateway implements PaymentGateway {
  readonly provider = 'cmi-mock';

  constructor(private readonly secret: string) {}

  checkoutUrl(coopCode: string, commandeId: string): string {
    return `/api/v1/coops/${encodeURIComponent(coopCode)}/paiements/mock/${commandeId}`;
  }

  private storeKey(coopCode: string): Buffer {
    return createHmac('sha256', this.secret).update(`cmi-store:${coopCode}`).digest();
  }

  sign(
    coopCode: string,
    f: Record<'oid' | 'amount' | 'currency' | 'Response' | 'TransId', string>,
  ): string {
    return createHmac('sha512', this.storeKey(coopCode))
      .update([f.oid, f.amount, f.currency, f.Response, f.TransId].join('|'))
      .digest('base64');
  }

  /** What the mock gateway posts back after the customer's decision. */
  buildCallback(
    coopCode: string,
    commandeId: string,
    amount: string,
    approved: boolean,
  ): Record<string, string> {
    const fields = {
      oid: commandeId,
      amount: toMoneyString(money(amount)),
      currency: MAD_CURRENCY,
      Response: approved ? 'Approved' : 'Declined',
      TransId: `MOCK-${randomBytes(6).toString('hex').toUpperCase()}`,
    };
    return { ...fields, HASH: this.sign(coopCode, fields) };
  }

  parseCallback(coopCode: string, raw: Record<string, unknown>): PaymentCallback {
    const field = (k: string): string => {
      const v = raw[k];
      if (typeof v !== 'string' || v.length === 0 || v.length > 200) throw invalidSignature();
      return v;
    };
    const f = {
      oid: field('oid'),
      amount: field('amount'),
      currency: field('currency'),
      Response: field('Response'),
      TransId: field('TransId'),
    };
    const expected = Buffer.from(this.sign(coopCode, f));
    const received = Buffer.from(field('HASH'));
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw invalidSignature();
    }
    if (f.currency !== MAD_CURRENCY) {
      throw new AppProblem(
        400,
        'devise_invalide',
        'Invalid currency',
        'Only MAD (504) is accepted',
      );
    }
    let amount: string;
    try {
      amount = toMoneyString(money(f.amount));
    } catch {
      throw invalidSignature();
    }
    return {
      commandeId: f.oid,
      amount,
      approved: f.Response === 'Approved',
      transactionId: f.TransId,
    };
  }
}
