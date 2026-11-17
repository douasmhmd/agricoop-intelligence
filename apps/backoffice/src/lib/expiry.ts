/** Level of a lot by days to expiry: same thresholds as the expiry alerts (30/60/90 days). */
export function expiryLevel(jours: number): 'perime' | 'j30' | 'j60' | 'j90' | 'ok' {
  if (jours <= 0) return 'perime';
  if (jours <= 30) return 'j30';
  if (jours <= 60) return 'j60';
  if (jours <= 90) return 'j90';
  return 'ok';
}
