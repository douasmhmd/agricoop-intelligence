import type { CommandeStatut, LotStatut, QrAlerte, QrStatut } from '@agricoop/shared';
import type { Tone } from '@/components/common';

export const commandeTone: Record<CommandeStatut, Tone> = {
  creee: 'info',
  payee: 'warning', // paid, waiting to be shipped
  expediee: 'info',
  livree: 'success',
  annulee: 'neutral',
};

export const lotTone: Record<LotStatut, Tone> = {
  disponible: 'success',
  epuise: 'neutral',
  perime: 'danger',
};

export const qrTone: Record<QrStatut, Tone> = {
  actif: 'success',
  desactive: 'neutral',
  signale: 'danger',
};

export const alerteTone: Record<'perime' | 'j30' | 'j60' | 'j90', Tone> = {
  perime: 'danger',
  j30: 'warning',
  j60: 'info',
  j90: 'neutral',
};

export const qrAlerteTone: Record<QrAlerte, Tone> = {
  qr_inactif: 'neutral',
  lot_perime: 'danger',
  scans_multiples: 'warning',
  villes_multiples: 'danger',
};

export const stockTone: Record<'rupture' | 'critique' | 'attention' | 'ok', Tone> = {
  rupture: 'danger',
  critique: 'warning',
  attention: 'info',
  ok: 'success',
};

export const qrNiveauTone: Record<'signale' | 'a_verifier', Tone> = {
  signale: 'danger',
  a_verifier: 'warning',
};
