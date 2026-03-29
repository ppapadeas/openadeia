/**
 * Greek engineer fee calculator
 * Source law: ΠΔ 696/74 Άρθρο 2, 83, 92 (as amended by ΠΔ 515/89)
 * Lambda frozen: ΦΕΚ Β' 2422/2013 (Δ17α/115/9/ΦΝ433) at λ=0.23368
 * ETA frozen:    ΦΕΚ 56Β/2012 at €118/τμ (ΤΕΕ practice)
 *
 * Core formula (Άρθρο 2 παρ. 4):
 *   β = κ + μ / ∛(Σ / (1000 × λ))           [β rounded to 2 decimal places]
 *   A = (β / 100) × Σ × (λ' / λ)             [since λ'=λ frozen, A = (β/100) × Σ]
 *
 * Budget calculation (ΥΑ 81304/1989):
 *   Σ_total = Σ(Ai × ΕΤΑ × φi)              [weighted sum of all area types]
 *
 * κ, μ tables (Άρθρο 83, 92):
 *   Per study type × building category (I-V)
 *
 * Building categories (Άρθρο 82):
 *   1=I (simple), 2=II (basic residential), 3=III (standard residential),
 *   4=IV (complex), 5=V (very complex)
 */

const LAMBDA_FROZEN = 0.23368;
const ETA = 118; // €/τμ, frozen since 2012

// Space-type weighting factors (ΥΑ 81304/1989) — applied to ETA to get cost per τμ
const AREA_COST = {
  A1:  ETA * 1.00, // Κύρια χρήση
  A2:  ETA * 0.40, // Ημιυπαίθριοι
  A3:  ETA * 0.20, // Πιλοτή
  A4:  ETA * 0.25, // Υπόγειο
  A5:  ETA * 0.30, // Στέγη κεκλιμένη
  A6:  ETA * 0.50, // Εξώστες / Μπαλκόνια
  A7:  ETA * 0.50, // Κλιμακοστάσια / Κοινόχρηστα
  A8:  ETA * 0.10, // Μηχανοστάσια / WC
  A9:  ETA * 0.20, // Αποθήκες
  A10: ETA * 0.50, // Ανοικτές θέσεις στάθμευσης
  A11: ETA * 0.50, // Κλειστές θέσεις στάθμευσης
};

// κ, μ coefficients per category (1-5) and study group
// Source: ΠΔ 696/74 Άρθρο 83 παρ. 1
const KM = {
  // α) Αρχιτεκτονικές μελέτες — applied on Σ_total
  arch: {
    1: { k: 0.80, m: 29 },
    2: { k: 1.00, m: 36 },
    3: { k: 1.80, m: 48 },
    4: { k: 2.40, m: 43 },
    5: { k: 2.90, m: 63 },
  },
  // β) Μελέτες φέρουσας κατασκευής — applied on Σ_static (≈ 2/3 × Σ_total)
  static: {
    1: { k: 2.00, m: 26 },
    2: { k: 2.40, m: 28 },
    3: { k: 3.00, m: 37 },
    4: { k: 3.70, m: 35 },
    5: { k: 3.70, m: 35 }, // Not listed; use IV as conservative
  },
  // γ) Μελέτες εγκαταστάσεων — per installation type's Σ
  // Art.83 para.15: +20% surcharge for cat. IV+ (applied separately)
  install: {
    1: { k: 1.50, m: 20 },
    2: { k: 2.00, m: 35 },
    3: { k: 2.30, m: 45 },
    4: { k: 2.50, m: 45 },
    5: { k: 2.50, m: 45 }, // Not listed; use IV + 20% via surcharge
  },
  // Επίβλεψη (Article 92) — same formula, different κ,μ
  // Cat. II and III share same values
  supervision: {
    1: { k: 1.10, m: 20 },
    2: { k: 1.30, m: 25 },
    3: { k: 1.30, m: 25 },
    4: { k: 2.00, m: 28 },
    5: { k: 1.50, m: 38 },
  },
};

// Study type definitions
// km: which κ,μ table to use
// sigmaFraction: fraction of Σ_total used as Σ for this study
// installSurcharge: true = apply 20% surcharge for cat. IV+
const STUDY_TYPES = {
  EP1:  { label: 'Αρχιτεκτονική μελέτη',    km: 'arch',       sigmaFraction: 1.00,    cat: 'study' },
  EP2:  { label: 'Στατική μελέτη',           km: 'static',     sigmaFraction: 2/3,     cat: 'study' },
  EP3:  { label: 'Θερμομόνωση',              km: 'install',    sigmaFraction: 0.10,    cat: 'study', installSurcharge: true },
  EP4:  { label: 'Η/Μ εγκαταστάσεις',       km: 'install',    sigmaFraction: 0.15,    cat: 'study', installSurcharge: true },
  EP5:  { label: 'Υδραυλικές εγκαταστάσεις',km: 'install',    sigmaFraction: 0.12,    cat: 'study', installSurcharge: true },
  EP6:  { label: 'Πυρασφάλεια',             km: 'install',    sigmaFraction: 0.05,    cat: 'study', installSurcharge: true },
  EP7:  { label: 'Ειδικές εγκρίσεις',       km: 'arch',       sigmaFraction: 0.10,    cat: 'study' },
  EP8:  { label: 'Μελέτη εδάφους',          km: 'static',     sigmaFraction: 0.10,    cat: 'study' },
  EP9:  { label: 'Μελέτη κυκλοφορίας',      km: 'arch',       sigmaFraction: 0.10,    cat: 'study' },
  EP10: { label: 'Τοπογραφικό',             km: 'arch',       sigmaFraction: 0.10,    cat: 'study' },
  EP11: { label: 'Φωτοτεχνική μελέτη',      km: 'install',    sigmaFraction: 0.08,    cat: 'study', installSurcharge: true },
  EP12: { label: 'Ακουστική μελέτη',        km: 'install',    sigmaFraction: 0.05,    cat: 'study', installSurcharge: true },
  EP13: { label: 'Ενεργειακή μελέτη (ΠΕΑ)', km: 'install',   sigmaFraction: 0.10,    cat: 'study', installSurcharge: true },
  EP14: { label: 'Παθητική πυροπροστασία',  km: 'install',    sigmaFraction: 0.05,    cat: 'study', installSurcharge: true },
  EP16: { label: 'Επίβλεψη αρχιτεκτονική', km: 'supervision', sigmaFraction: 1.00,   cat: 'supervision' },
  EP17: { label: 'Επίβλεψη στατική',        km: 'supervision', sigmaFraction: 2/3,    cat: 'supervision' },
  EP18: { label: 'Επίβλεψη Η/Μ',           km: 'supervision', sigmaFraction: 0.15,   cat: 'supervision', installSurcharge: true },
  EP19: { label: 'Επίβλεψη υδραυλικών',    km: 'supervision', sigmaFraction: 0.12,   cat: 'supervision', installSurcharge: true },
  EP20: { label: 'Επίβλεψη πυρασφάλειας',  km: 'supervision', sigmaFraction: 0.05,   cat: 'supervision', installSurcharge: true },
  EP21: { label: 'Επίβλεψη θερμομόνωσης',  km: 'supervision', sigmaFraction: 0.10,   cat: 'supervision', installSurcharge: true },
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * Extract building category (1-5) from the difficulty parameter.
 * Accepts:
 *   - number: used directly (1-5)
 *   - object with `category` key
 *   - object with S1-S11 keys (old format): uses S1 or mode
 */
function extractCategory(difficulty) {
  if (typeof difficulty === 'number') {
    return Math.max(1, Math.min(5, Math.round(difficulty)));
  }
  if (difficulty && typeof difficulty === 'object') {
    // New format
    if (typeof difficulty.category === 'number') {
      return Math.max(1, Math.min(5, Math.round(difficulty.category)));
    }
    // Legacy format: S1-S11, use S1 as primary (main space type difficulty)
    const s1 = parseFloat(difficulty.S1 ?? difficulty.S2 ?? 3);
    if (!isNaN(s1)) return Math.max(1, Math.min(5, Math.round(s1)));
  }
  return 3; // Default: category III (standard residential)
}

/**
 * Calculate β coefficient per ΠΔ 696/74 Article 2 para. 4
 * β = κ + μ / ∛(Σ / (1000 × λ))
 * β is rounded to 2 decimal places per law
 */
function calcBeta(k, m, sigma, lambda) {
  const cubeRoot = Math.cbrt(sigma / (1000 * lambda));
  const beta = k + m / cubeRoot;
  return r2(beta);
}

/**
 * Main fee calculator per ΠΔ 696/74
 *
 * @param {Object} params
 * @param {Object} params.areas - area values in τμ: { A1, A2, ... }
 * @param {number|Object} params.difficulty - building category 1-5 or object
 * @param {Object} params.studies - selected studies: { EP1: true, EP2: true, ... }
 * @param {Object} params.ksPercents - DEPRECATED, ignored (kept for API compat)
 * @param {number} params.lambdaValue - λ value (default: 0.23368 frozen)
 * @param {number} params.fpa - VAT percentage (default: 24)
 * @param {boolean} params.isDemolition - whether this is a demolition project
 *
 * @returns {Object} { lambda, P, SA, SE, SUM, PA1, P1, breakdown }
 *   P   = Σ_total (total construction budget, the calculation basis)
 *   SA  = total study fees (net)
 *   SE  = total supervision fees (net)
 *   SUM = SA + SE
 *   PA1 = VAT on SUM
 *   P1  = SUM + PA1
 */
export function calculateFees({
  areas = {}, difficulty = 3, studies = {},
  _ksPercents = {}, lambdaValue = LAMBDA_FROZEN, fpa = 24, _isDemolition = false
}) {
  const lambda = lambdaValue || LAMBDA_FROZEN;
  const category = extractCategory(difficulty);

  // ── Step 1: Calculate total construction budget Σ_total ──────────────────
  let sigmaTotal = 0;
  const areaBreakdown = {};
  for (const [key, unitCost] of Object.entries(AREA_COST)) {
    const area = parseFloat(areas[key] ?? 0);
    if (!area) continue;
    const contrib = area * unitCost;
    areaBreakdown[key] = {
      area,
      unitCost: r2(unitCost),
      contribution: r2(contrib),
    };
    sigmaTotal += contrib;
  }

  // ── Step 2: Calculate fee for each selected study ────────────────────────
  let SA = 0;
  let SE = 0;
  const studyBreakdown = {};
  const supervisionBreakdown = {};

  for (const [ep, def] of Object.entries(STUDY_TYPES)) {
    if (!studies[ep]) continue;

    // σ for this study = Σ_total × sigma fraction
    const sigma = sigmaTotal * def.sigmaFraction;
    if (sigma <= 0) continue;

    // Get κ, μ for this study type + category
    const kmTable = KM[def.km];
    const { k, m } = kmTable[category] ?? kmTable[3];

    // β = κ + μ / ∛(Σ / (1000 × λ))
    const beta = calcBeta(k, m, sigma, lambda);

    // A = (β / 100) × Σ
    let fee = (beta / 100) * sigma;

    // Art.83 para.15 / Art.92 para.2: +20% for installation studies in cat. IV+
    const surcharge = def.installSurcharge && category >= 4 ? 1.20 : 1.00;
    fee *= surcharge;

    const result = {
      label: def.label,
      km: def.km,
      category,
      sigma: r2(sigma),
      sigmaFraction: def.sigmaFraction,
      k, m, beta,
      surcharge,
      fee: r2(fee),
    };

    if (def.cat === 'study') {
      studyBreakdown[ep] = result;
      SA += fee;
    } else {
      supervisionBreakdown[ep] = result;
      SE += fee;
    }
  }

  const SUM = SA + SE;
  const PA1 = SUM * (fpa / 100);
  const P1 = SUM + PA1;

  return {
    lambda,
    category,
    P: r2(sigmaTotal), // Construction budget (the basis)
    SA: r2(SA),
    SE: r2(SE),
    SUM: r2(SUM),
    PA1: r2(PA1),
    P1: r2(P1),
    breakdown: {
      areas: areaBreakdown,
      studies: studyBreakdown,
      supervision: supervisionBreakdown,
    },
  };
}

// ── ΚΗ (Κρατική εισφορά / permit cost) ─────────────────────────────────────
// Progressive tiers based on budget (k€)
// Source: ΦΕΚ Β' 2422/2013, Παρ. 2
export function calcKH(budget, { isNewBuilding = true, municipalRate = 0 } = {}) {
  let kh;
  if (isNewBuilding) {
    const tiers = [
      [0,       29.347,  0    ],
      [29.347,  73.368,  0.005],
      [73.368,  146.735, 0.01 ],
      [146.735, 293.47,  0.015],
      [293.47,  Infinity, 0.02],
    ];
    kh = tiers.reduce((acc, [lo, hi, rate]) =>
      acc + (Math.max(0, Math.min(budget, hi) - lo) * rate), 0);
  } else {
    kh = budget * 0.02;
  }
  const municipal = r2(kh * (municipalRate / 100));
  return { kh: r2(kh - municipal), municipal, total: r2(kh) };
}

export function calcTEE(budget, isRepair = false) {
  return Math.max(isRepair ? 0.01 : 0.07, r2(budget * 0.00025));
}

export function calcEFKA(budget, totalFee) {
  return r2(budget * 0.0015 + totalFee * 0.03);
}
