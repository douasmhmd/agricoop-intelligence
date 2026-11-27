import type { AnomalyPolicy } from './anomaly';

export interface QrConfig {
  /** Storefront origin; labels encode `${webPublicUrl}/v/<token>`. */
  webPublicUrl: string;
  /** Upper bound of labels per generation request. */
  maxLabels: number;
  anomaly: AnomalyPolicy;
}

export const QR_CONFIG = Symbol.for('agricoop.QR_CONFIG');
