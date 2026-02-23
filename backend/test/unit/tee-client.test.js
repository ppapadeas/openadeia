import { describe, it, expect } from 'vitest';
import { teeStatusToStage, teeTypeCodeToPermitType } from '../../src/services/tee-client.js';

describe('teeStatusToStage', () => {
  it('εγκρίθηκε → approved', () => {
    expect(teeStatusToStage('εγκρίθηκε', null)).toBe('approved');
  });
  it('εκδόθηκε → approved', () => {
    expect(teeStatusToStage('εκδόθηκε', null)).toBe('approved');
  });
  it('status code "5" → approved', () => {
    expect(teeStatusToStage('', '5')).toBe('approved');
  });
  it('status code "4" → review', () => {
    expect(teeStatusToStage('', '4')).toBe('review');
  });
  it('status code "3" → submission', () => {
    expect(teeStatusToStage('', '3')).toBe('submission');
  });
  it('unknown status → data_collection', () => {
    expect(teeStatusToStage('', '')).toBe('data_collection');
    expect(teeStatusToStage(null, null)).toBe('data_collection');
  });
});

describe('teeTypeCodeToPermitType', () => {
  it('is_continuation=true → revision by default', () => {
    expect(teeTypeCodeToPermitType(0, true)).toBe('revision');
  });
  it('continuation code 3 → file_update', () => {
    expect(teeTypeCodeToPermitType(3, true)).toBe('file_update');
  });
  it('continuation code 4 → revision_ext', () => {
    expect(teeTypeCodeToPermitType(4, true)).toBe('revision_ext');
  });
  it('new act code 1 → new_building', () => {
    expect(teeTypeCodeToPermitType(1, false)).toBe('new_building');
  });
  it('unknown code → new_building (safe default)', () => {
    expect(teeTypeCodeToPermitType(99, false)).toBe('new_building');
  });
  it('minor_cat1 codes', () => {
    expect(teeTypeCodeToPermitType(5, false)).toBe('minor_cat1');
    expect(teeTypeCodeToPermitType(6, false)).toBe('minor_cat1');
  });
});
