import { describe, it, expect } from 'vitest';
import { teeStatusToStage, teeTypeCodeToPermitType } from '../../src/services/tee-client.js';

// ── teeStatusToStage ────────────────────────────────────────────────

describe('teeStatusToStage', () => {
  // Greek text matching
  it('εγκρίθηκε → approved', () => {
    expect(teeStatusToStage('εγκρίθηκε', null)).toBe('approved');
  });
  it('εκδόθηκε → approved', () => {
    expect(teeStatusToStage('εκδόθηκε', null)).toBe('approved');
  });
  it('Εγκρίθηκε (uppercase first letter) → approved', () => {
    expect(teeStatusToStage('Εγκρίθηκε', null)).toBe('approved');
  });
  it('ελέγχεται → review', () => {
    expect(teeStatusToStage('ελέγχεται', null)).toBe('review');
  });
  it('σε έλεγχο → review', () => {
    expect(teeStatusToStage('σε έλεγχο', null)).toBe('review');
  });
  it('υποβολή → submission', () => {
    expect(teeStatusToStage('υποβολή', null)).toBe('submission');
  });
  it('υποβλήθηκε → submission', () => {
    expect(teeStatusToStage('υποβλήθηκε', null)).toBe('submission');
  });
  it('English "submit" → submission', () => {
    expect(teeStatusToStage('submit', null)).toBe('submission');
  });
  it('υπογραφές → signatures', () => {
    expect(teeStatusToStage('υπογραφές', null)).toBe('signatures');
  });
  it('μελέτες → studies', () => {
    expect(teeStatusToStage('μελέτες', null)).toBe('studies');
  });
  it('μελετάται → studies', () => {
    expect(teeStatusToStage('μελετάται', null)).toBe('studies');
  });

  // Status code matching
  it('status code "5" → approved', () => {
    expect(teeStatusToStage('', '5')).toBe('approved');
  });
  it('status code "4" → review', () => {
    expect(teeStatusToStage('', '4')).toBe('review');
  });
  it('status code "3" → submission', () => {
    expect(teeStatusToStage('', '3')).toBe('submission');
  });
  it('status code "2" → signatures', () => {
    expect(teeStatusToStage('', '2')).toBe('signatures');
  });
  it('status code "1" → studies', () => {
    expect(teeStatusToStage('', '1')).toBe('studies');
  });

  // Text takes precedence over conflicting code (first match wins)
  it('text "εγκρίθηκε" wins over code "1"', () => {
    expect(teeStatusToStage('εγκρίθηκε', '1')).toBe('approved');
  });

  // Fallback
  it('unknown status → data_collection', () => {
    expect(teeStatusToStage('', '')).toBe('data_collection');
    expect(teeStatusToStage(null, null)).toBe('data_collection');
    expect(teeStatusToStage(undefined, undefined)).toBe('data_collection');
    expect(teeStatusToStage('αγνωστη κατάσταση', '99')).toBe('data_collection');
  });

  // NFD normalization (accented Greek)
  it('handles NFD-normalized accented Greek', () => {
    // Create an NFD string (decomposed accents) — should still match
    const ekdothike = 'εκδόθηκε'.normalize('NFD');
    expect(teeStatusToStage(ekdothike, null)).toBe('approved');
  });
});

// ── teeTypeCodeToPermitType ─────────────────────────────────────────

describe('teeTypeCodeToPermitType', () => {
  describe('new permits (is_continuation=false)', () => {
    it('code 1 → new_building', () => {
      expect(teeTypeCodeToPermitType(1, false)).toBe('new_building');
    });
    it('code 5 → minor_cat1', () => {
      expect(teeTypeCodeToPermitType(5, false)).toBe('minor_cat1');
    });
    it('code 6 → minor_cat1', () => {
      expect(teeTypeCodeToPermitType(6, false)).toBe('minor_cat1');
    });
    it('code 7 → minor_cat2', () => {
      expect(teeTypeCodeToPermitType(7, false)).toBe('minor_cat2');
    });
    it('code 8 → minor_cat2', () => {
      expect(teeTypeCodeToPermitType(8, false)).toBe('minor_cat2');
    });
    it('code 9 → vod', () => {
      expect(teeTypeCodeToPermitType(9, false)).toBe('vod');
    });
    it('code 10 → preapproval', () => {
      expect(teeTypeCodeToPermitType(10, false)).toBe('preapproval');
    });
    it('unknown code → new_building (safe default)', () => {
      expect(teeTypeCodeToPermitType(99, false)).toBe('new_building');
      expect(teeTypeCodeToPermitType(0, false)).toBe('new_building');
      expect(teeTypeCodeToPermitType(null, false)).toBe('new_building');
    });
    it('string code coerced to number', () => {
      expect(teeTypeCodeToPermitType('9', false)).toBe('vod');
      expect(teeTypeCodeToPermitType('1', false)).toBe('new_building');
    });
  });

  describe('continuations (is_continuation=true)', () => {
    it('code 3 → file_update', () => {
      expect(teeTypeCodeToPermitType(3, true)).toBe('file_update');
    });
    it('code 4 → revision_ext', () => {
      expect(teeTypeCodeToPermitType(4, true)).toBe('revision_ext');
    });
    it('default → revision', () => {
      expect(teeTypeCodeToPermitType(0, true)).toBe('revision');
      expect(teeTypeCodeToPermitType(1, true)).toBe('revision');
      expect(teeTypeCodeToPermitType(99, true)).toBe('revision');
    });
  });
});
