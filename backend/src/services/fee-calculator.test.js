import { describe, it, expect } from 'vitest';
import { calculateFees, calcKH } from './fee-calculator.js';

/**
 * Reference calculation per ΦΕΚ Β' 2422/2013 (λ=0.23368 frozen, KS in ‰)
 * 500m² A1 (difficulty 3), 8.5m² A8 (difficulty 2)
 * Studies: EP1,EP2,EP3,EP4,EP5,EP6,EP10,EP11,EP13
 * Supervision: EP16,EP17,EP18,EP19,EP20,EP21
 * KS sum studies: 15+250+70+90+100+25+60+20+15 = 645 ‰
 * KS sum supervision: 30+30+0+0+70+80 = 210 ‰
 */
describe('Fee calculator — ΦΕΚ Β\' 2422/2013', () => {
  const result = calculateFees({
    areas: { A1: 500, A8: 8.5 },
    difficulty: {
      S1: 3, S2: 3, S3: 2, S4: 2, S5: 2, S6: 2,
      S7: 3, S8: 2, S9: 3, S10: 3, S11: 3, S12: 2, S13: 4, S14: 3,
    },
    studies: {
      EP1: true, EP2: true, EP3: true, EP4: true, EP5: true,
      EP6: true, EP10: true, EP11: true, EP13: true,
      EP16: true, EP17: true, EP18: true, EP19: true,
      EP20: true, EP21: true,
    },
    lambdaValue: 0.23368,
    fpa: 24,
  });

  // P = λ × (500 × 41.782 × 3 + 8.5 × 4.1782 × 2) = 0.23368 × 62742.8 ≈ 14661.6
  it('P base fee (ΤΑ)', () => expect(result.P).toBeCloseTo(14661.6, 0));

  // SA = P × 645/1000 = 14661.6 × 0.645 ≈ 9456.7
  it('SA study fees', () => expect(result.SA).toBeCloseTo(9456.7, 0));

  // SE = P × 210/1000 = 14661.6 × 0.210 ≈ 3078.9
  it('SE supervision fees', () => expect(result.SE).toBeCloseTo(3078.9, 0));

  // SUM = SA + SE ≈ 12535.6
  it('SUM total', () => expect(result.SUM).toBeCloseTo(12535.6, 0));

  // P1 = SUM × 1.24 ≈ 15544.4
  it('P1 with FPA 24%', () => expect(result.P1).toBeCloseTo(15544.4, 0));

  // Ratio checks
  it('SA/P ≈ 64.5%', () => expect(result.SA / result.P).toBeCloseTo(0.645, 2));
  it('SE/P ≈ 21.0%', () => expect(result.SE / result.P).toBeCloseTo(0.210, 2));
});

describe('ΚΗ tiered levy (ΦΕΚ Β\' 2422/2013)', () => {
  // Below 29.347 k€ threshold: 0
  it('zero below threshold (29.347)',  () => expect(calcKH(29).kh).toBe(0));

  // 200 k€: tiers 29.347→73.368 at 0.5%, 73.368→146.735 at 1%, 146.735→200 at 1.5%
  // = (73.368-29.347)×0.005 + (146.735-73.368)×0.01 + (200-146.735)×0.015
  // = 0.22011 + 0.73367 + 0.79898 = 1.75276
  it('tiered mid budget (200)',    () => expect(calcKH(200).kh).toBeCloseTo(1.75, 1));

  // Renovation: flat 2% of full budget
  it('flat 2% for renovation (1000)', () => expect(calcKH(1000, { isNewBuilding: false }).kh).toBe(20));
});
