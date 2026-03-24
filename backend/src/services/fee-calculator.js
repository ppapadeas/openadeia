/**
 * Greek engineer fee calculator
 * Source law: ΦΕΚ Β' 2422/2013 (Απόφαση Δ17α/115/9/ΦΝ433)
 *
 * Formula:
 *   ΤΑ (Τυπική Αμοιβή / P) = λ × Σ(Ai × ΣΒνi × Si)
 *   Fee per study/supervision EPi = P × KSi / 1000  (KS values are ‰)
 *   PA1 (ΦΠΑ) = SUM × fpa/100
 *   P1 (total with VAT) = SUM + PA1
 *
 * KS coefficients (per ‰ of ΤΑ):
 *   KS1=15 → 1.5% for Αρχιτεκτονική μελέτη
 *   KS2=250 → 25% for Στατική μελέτη (dominant study)
 *   etc.
 *
 * Lambda (λ) frozen at 0.23368 from 2012 Q1 per ΦΕΚ Β' 2422/2013.
 */

const LAMBDA_FROZEN = 0.23368;

const KS_DEFAULTS = {
  standard: {
    KS1:15,  KS2:250, KS3:70,  KS4:90,  KS5:100, KS6:25,  KS7:60,
    KS8:15,  KS9:40,  KS10:60, KS11:20, KS12:10, KS13:15, KS14:20,
    KS15:0,  KS16:30, KS17:30, KS18:0,  KS19:0,  KS20:70, KS21:80,
  },
  demolition: {
    KS1:15,  KS2:250, KS3:70,  KS4:90,  KS5:100, KS6:25,  KS7:60,
    KS8:15,  KS9:40,  KS10:70, KS11:10, KS12:15, KS13:20, KS14:0,
    KS15:35, KS16:35, KS17:0,  KS18:0,  KS19:70, KS20:80,
  },
};

const STUDY_TYPES = {
  EP1:  { label:'Αρχιτεκτονική μελέτη',    ks:'KS1',  cat:'study' },
  EP2:  { label:'Στατική μελέτη',           ks:'KS2',  cat:'study' },
  EP3:  { label:'Θερμομόνωση',              ks:'KS3',  cat:'study' },
  EP4:  { label:'Η/Μ εγκαταστάσεις',        ks:'KS4',  cat:'study' },
  EP5:  { label:'Υδραυλικές εγκαταστάσεις', ks:'KS5',  cat:'study' },
  EP6:  { label:'Πυρασφάλεια',              ks:'KS6',  cat:'study' },
  EP7:  { label:'Ειδικές εγκρίσεις',        ks:'KS7',  cat:'study' },
  EP8:  { label:'Μελέτη εδάφους',           ks:'KS8',  cat:'study' },
  EP9:  { label:'Μελέτη κυκλοφορίας',       ks:'KS9',  cat:'study' },
  EP10: { label:'Τοπογραφικό',              ks:'KS10', cat:'study' },
  EP11: { label:'Φωτοτεχνική μελέτη',       ks:'KS11', cat:'study' },
  EP12: { label:'Ακουστική μελέτη',         ks:'KS12', cat:'study' },
  EP13: { label:'Ενεργειακή μελέτη (ΠΕΑ)', ks:'KS13', cat:'study' },
  EP14: { label:'Παθητική πυροπροστασία',   ks:'KS14', cat:'study' },
  EP16: { label:'Επίβλεψη αρχιτεκτονική',  ks:'KS16', cat:'supervision' },
  EP17: { label:'Επίβλεψη στατική',         ks:'KS17', cat:'supervision' },
  EP18: { label:'Επίβλεψη Η/Μ',            ks:'KS18', cat:'supervision' },
  EP19: { label:'Επίβλεψη υδραυλικών',     ks:'KS19', cat:'supervision' },
  EP20: { label:'Επίβλεψη πυρασφάλειας',   ks:'KS20', cat:'supervision' },
  EP21: { label:'Επίβλεψη θερμομόνωσης',   ks:'KS21', cat:'supervision' },
};

// Area weights (ΣΒν) per ΦΕΚ Β' 2422/2013
// A1 baseline = 41.782 calibrated to frozen λ=0.23368
// Ratios: A2=0.4×A1, A3=0.2×A1, A4=0.3×A1, A5=0.3×A1,
//         A6=A7=0.5×A1, A8=0.1×A1, A9=0.2×A1, A10=A11=0.5×A1
const W = 41.782;
const AREA_WEIGHTS = {
  A1:  W * 1.0, // Κύρια χρήση
  A2:  W * 0.4, // Ημιυπαίθριοι
  A3:  W * 0.2, // Πιλοτή
  A4:  W * 0.3, // Υπόγειο
  A5:  W * 0.3, // Στέγη κεκλιμένη
  A6:  W * 0.5, // Εξώστες/Μπαλκόνια
  A7:  W * 0.5, // Κλιμακοστάσια/κοινόχρηστα
  A8:  W * 0.1, // Μηχανοστάσια/WC
  A9:  W * 0.2, // Αποθήκες
  A10: W * 0.5, // Ανοικτές θέσεις στάθμευσης
  A11: W * 0.5, // Κλειστές θέσεις στάθμευσης
};

const r2 = n => Math.round(n * 100) / 100;

export function calculateFees({
  areas = {}, difficulty = {}, studies = {},
  ksPercents = {}, lambdaValue = LAMBDA_FROZEN, fpa = 24, isDemolition = false
}) {
  const defaults = isDemolition ? KS_DEFAULTS.demolition : KS_DEFAULTS.standard;

  let weightedSum = 0;
  const areaBreakdown = {};
  for (const [key, w] of Object.entries(AREA_WEIGHTS)) {
    const area = parseFloat(areas[key] ?? 0);
    if (!area) continue;
    const sKey = 'S' + key.slice(1);
    const s = parseFloat(difficulty[sKey] ?? 2);
    const contrib = area * w * s;
    areaBreakdown[key] = { area, weight: w, difficulty: s, contribution: r2(contrib) };
    weightedSum += contrib;
  }
  const P = weightedSum * lambdaValue;

  // KS values are in ‰ (per mille) — divide by 1000
  let SA = 0;
  const studyBreakdown = {};
  for (const [ep, def] of Object.entries(STUDY_TYPES)) {
    if (!studies[ep] || def.cat !== 'study') continue;
    const ks = ksPercents[def.ks] ?? defaults[def.ks] ?? 0;
    const fee = P * ks / 1000;
    studyBreakdown[ep] = { label: def.label, ks: def.ks, ksValue: ks, fee: r2(fee) };
    SA += fee;
  }

  let SE = 0;
  const supervisionBreakdown = {};
  for (const [ep, def] of Object.entries(STUDY_TYPES)) {
    if (!studies[ep] || def.cat !== 'supervision') continue;
    const ks = ksPercents[def.ks] ?? defaults[def.ks] ?? 0;
    const fee = P * ks / 1000;
    supervisionBreakdown[ep] = { label: def.label, ks: def.ks, ksValue: ks, fee: r2(fee) };
    SE += fee;
  }

  const SUM = SA + SE;
  const PA1 = SUM * (fpa / 100);
  const P1 = SUM + PA1;

  return {
    lambda: lambdaValue,
    P: r2(P), SA: r2(SA), SE: r2(SE), SUM: r2(SUM), PA1: r2(PA1), P1: r2(P1),
    breakdown: { areas: areaBreakdown, studies: studyBreakdown, supervision: supervisionBreakdown },
  };
}

// ΚΗ (Κρατική εισφορά - κόστος αδείας) — progressive tiers (budget in k€, KH in k€)
// Source: ΦΕΚ Β' 2422/2013, Παρ. 2
// Tiers: 0–29.347: 0%, 29.347–73.368: 0.5%, 73.368–146.735: 1%, 146.735–293.47: 1.5%, >293.47: 2%
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
