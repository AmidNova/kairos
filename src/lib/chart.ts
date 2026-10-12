import type { PricePoint } from "./types";

const SIMULATED_POINTS = 24;
const HOUR_MS = 3_600_000;

/**
 * Graduations « propres » (1, 2, 2.5, 5 × 10^n) couvrant [min, max].
 * Renvoie au moins deux valeurs, même quand min === max.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const rough = span / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;

  const start = Math.floor((min === max ? min - span / 2 : min) / step) * step;
  const end = Math.ceil((min === max ? max + span / 2 : max) / step) * step;
  const count = Math.round((end - start) / step);
  return Array.from({ length: count + 1 }, (_, i) => Number((start + i * step).toFixed(10)));
}

/**
 * Courbe de démonstration quand un produit n'a pas encore d'historique.
 * Toujours affichée avec le badge « Simulated » dans l'UI.
 */
export function simulateHistory(price: number, now: number = Date.now()): PricePoint[] {
  return Array.from({ length: SIMULATED_POINTS }, (_, i) => {
    const isLast = i === SIMULATED_POINTS - 1;
    const noise = Math.sin(i / 2.3) * 0.04 + (Math.random() - 0.5) * 0.05;
    return {
      price: isLast ? price : Number((price * (1 + noise)).toFixed(2)),
      checked_at: new Date(now - (SIMULATED_POINTS - 1 - i) * HOUR_MS).toISOString(),
    };
  });
}

/** Variation en % entre le premier et le dernier point, null si non calculable. */
export function percentChange(points: readonly PricePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}
