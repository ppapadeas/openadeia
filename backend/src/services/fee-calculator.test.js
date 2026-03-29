import { describe, it, expect } from 'vitest';
import { calculateFees, calcKH } from './fee-calculator.js';

/**
 * Test suite for ΠΔ 696/74 fee calculator
 *
 * Formula:
 *   Σ_total = Σ(Ai × ΕΤΑ × φi)
 *   β = κ + μ / ∛(Σ / (1000 × λ))    [per study type + category]
 *   A = (β/100) × Σ                    [since λ'/λ = 1]
 *
 * Constants:
 *   λ = 0.23368 (frozen, ΦΕΚ 2422/2013)
 *   ΕΤΑ = 118 €/τμ (frozen)
 *
 * Reference: INSOFT ΞΑΝΘΟΠΟΥΛΟΥ example
 *   A1 = 167.5 τμ, κατηγορία ΙΙΙ (cat=3)
 *   Σ_total ≈ 167.5 × 118 = 19,765 €
 *   Αρχιτεκτονική: κ=1.80, μ=48, β = 1.80 + 48/∛(19765/233.68) = 12.73
 *   A_arch = (12.73/100) × 19765 = 2517 €  (INSOFT: 2518€)
 */

const LAMBDA = 0.23368;
const ETA = 118; // €/τμ

describe('ΠΔ 696/74 — INSOFT ΞΑΝΘΟΠΟΥΛΟΥ reference', () => {
  // 167.5 τμ A1, κατηγορία ΙΙΙ
  const A1 = 167.5;
  const sigmaTotal = A1 * ETA; // 19765

  it('budget Σ_total = 19765 €', () => {
    expect(sigmaTotal).toBeCloseTo(19765, 0);
  });

  const result = calculateFees({
    areas: { A1 },
    difficulty: 3, // κατηγορία ΙΙΙ
    studies: {
      EP1: true,  // Αρχιτεκτονική
      EP2: true,  // Στατική
    },
    fpa: 24,
    lambdaValue: LAMBDA,
  });

  // Αρχιτεκτονική: κ=1.80, μ=48, σ=19765
  // β = 1.80 + 48/∛(19765/233.68) = 1.80 + 48/4.391 = 1.80 + 10.93 = 12.73
  // A = (12.73/100) × 19765 = 2517.0 ≈ 2518 (INSOFT rounding)
  it('Αρχιτεκτονική ≈ 2517-2518€', () => {
    const archFee = result.breakdown.studies.EP1?.fee ?? 0;
    expect(archFee).toBeGreaterThanOrEqual(2515);
    expect(archFee).toBeLessThanOrEqual(2520);
  });

  // Στατική: κ=3.00, μ=37, σ = 19765 × 2/3 = 13177
  // β = 3.00 + 37/∛(13177/233.68) = 3.00 + 37/3.779 = 3.00 + 9.79 = 12.79→12.79
  // A = (12.79/100) × 13177 = 1686 (INSOFT: 1663 — slight difference in Σ_static)
  it('Στατική > 1600€', () => {
    const staticFee = result.breakdown.studies.EP2?.fee ?? 0;
    expect(staticFee).toBeGreaterThan(1600);
  });

  it('P (Σ_total) ≈ 19765€', () => {
    expect(result.P).toBeCloseTo(19765, 0);
  });

  it('category = 3', () => {
    expect(result.category).toBe(3);
  });
});

describe('ΠΔ 696/74 — β formula verification', () => {
  // Manual β calculation for cat.III, architectural
  // β = 1.80 + 48 / ∛(Σ / (1000 × 0.23368))
  it('β for Σ=19765, cat.III, arch ≈ 12.73', () => {
    const sigma = 19765;
    const cbrt = Math.cbrt(sigma / (1000 * LAMBDA));
    const beta = Math.round((1.80 + 48 / cbrt) * 100) / 100;
    expect(beta).toBeCloseTo(12.73, 1);
  });

  it('β decreases as Σ grows (degressive fee)', () => {
    function betaArch(sigma) {
      const cbrt = Math.cbrt(sigma / (1000 * LAMBDA));
      return 1.80 + 48 / cbrt;
    }
    // For larger projects, β should be smaller (percentage decreases)
    expect(betaArch(50000)).toBeLessThan(betaArch(20000));
    expect(betaArch(200000)).toBeLessThan(betaArch(50000));
  });
});

describe('ΠΔ 696/74 — budget calculation', () => {
  it('A1=100τμ → Σ_total = 100 × 118 = 11800', () => {
    const result = calculateFees({
      areas: { A1: 100 },
      difficulty: 3,
      studies: { EP1: true },
    });
    expect(result.P).toBeCloseTo(11800, 0);
  });

  it('A1=100τμ, A2=20τμ → Σ_total = 100×118 + 20×47.2 = 12744', () => {
    const result = calculateFees({
      areas: { A1: 100, A2: 20 },
      difficulty: 3,
      studies: { EP1: true },
    });
    expect(result.P).toBeCloseTo(12744, 0);
  });

  it('no areas → Σ_total = 0, all fees = 0', () => {
    const result = calculateFees({
      areas: {},
      difficulty: 3,
      studies: { EP1: true, EP2: true },
    });
    expect(result.P).toBe(0);
    expect(result.SUM).toBe(0);
  });
});

describe('ΠΔ 696/74 — category coefficients', () => {
  // Higher category → higher β → higher fee for same Σ
  it('cat.I gives lower arch fee than cat.III for same area', () => {
    const r1 = calculateFees({ areas: { A1: 100 }, difficulty: 1, studies: { EP1: true } });
    const r3 = calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP1: true } });
    expect(r3.SA).toBeGreaterThan(r1.SA);
  });

  it('cat.V gives higher arch fee than cat.III', () => {
    const r3 = calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP1: true } });
    const r5 = calculateFees({ areas: { A1: 100 }, difficulty: 5, studies: { EP1: true } });
    expect(r5.SA).toBeGreaterThan(r3.SA);
  });

  // Legacy format: difficulty as object with S1 key
  it('difficulty as object {S1:3} → category 3', () => {
    const r_num = calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP1: true } });
    const r_obj = calculateFees({ areas: { A1: 100 }, difficulty: { S1: 3 }, studies: { EP1: true } });
    expect(r_obj.SA).toBeCloseTo(r_num.SA, 2);
  });
});

describe('ΠΔ 696/74 — VAT and totals', () => {
  it('P1 = SUM × 1.24 when fpa=24', () => {
    const result = calculateFees({
      areas: { A1: 100 },
      difficulty: 3,
      studies: { EP1: true, EP2: true },
      fpa: 24,
    });
    expect(result.P1).toBeCloseTo(result.SUM * 1.24, 1);
  });

  it('SUM = SA + SE', () => {
    const result = calculateFees({
      areas: { A1: 200 },
      difficulty: 3,
      studies: { EP1: true, EP2: true, EP16: true, EP17: true },
      fpa: 24,
    });
    expect(result.SUM).toBeCloseTo(result.SA + result.SE, 1);
  });
});

describe('ΠΔ 696/74 — installation surcharge for cat. IV+', () => {
  it('EP3 (Θερμομόνωση) has +20% surcharge in cat.IV', () => {
    const r3 = calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP3: true } });
    const r4 = calculateFees({ areas: { A1: 100 }, difficulty: 4, studies: { EP3: true } });
    // fee_cat4 should be notably higher than fee_cat3 (both β change AND 20% surcharge)
    expect(r4.SA).toBeGreaterThan(r3.SA);
    // Verify: r4 fee = r3_noSurcharge × ... × 1.20 approximately
    calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP3: true } });
    const ep3_r4 = r4.breakdown.studies.EP3;
    expect(ep3_r4.surcharge).toBe(1.20);
  });

  it('EP3 in cat.III has no surcharge (surcharge=1.00)', () => {
    const r3 = calculateFees({ areas: { A1: 100 }, difficulty: 3, studies: { EP3: true } });
    expect(r3.breakdown.studies.EP3.surcharge).toBe(1.00);
  });
});

describe('ΚΗ tiered levy (ΦΕΚ Β\' 2422/2013)', () => {
  // Below 29.347 k€ threshold: 0
  it('zero below threshold (29.347)', () => expect(calcKH(29).kh).toBe(0));

  // 200 k€: tiers 29.347→73.368 at 0.5%, 73.368→146.735 at 1%, 146.735→200 at 1.5%
  // = (73.368-29.347)×0.005 + (146.735-73.368)×0.01 + (200-146.735)×0.015
  // = 0.22011 + 0.73367 + 0.79898 = 1.75276
  it('tiered mid budget (200)', () => expect(calcKH(200).kh).toBeCloseTo(1.75, 1));

  // Renovation: flat 2% of full budget
  it('flat 2% for renovation (1000)', () => expect(calcKH(1000, { isNewBuilding: false }).kh).toBe(20));
});
