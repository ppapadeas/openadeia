import { describe, it, expect } from 'vitest';
import { encryptTeePassword, decryptTeePassword } from '../../src/routes/auth.js';

describe('TEE password crypto', () => {
  it('round-trips: encrypt then decrypt returns original', () => {
    const original = 'my-tee-p@ssw0rd!';
    const encrypted = encryptTeePassword(original);
    expect(decryptTeePassword(encrypted)).toBe(original);
  });

  it('encrypted value is iv_hex:enc_hex format', () => {
    const encrypted = encryptTeePassword('test');
    expect(encrypted).toMatch(/^[a-f0-9]{32}:[a-f0-9]+$/);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const enc1 = encryptTeePassword('same-password');
    const enc2 = encryptTeePassword('same-password');
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decryptTeePassword(enc1)).toBe('same-password');
    expect(decryptTeePassword(enc2)).toBe('same-password');
  });

  it('returns null for invalid ciphertext', () => {
    expect(decryptTeePassword('not-valid')).toBeNull();
  });

  it('handles special characters', () => {
    const pw = 'Ελληνικά!@#$%^&*()';
    expect(decryptTeePassword(encryptTeePassword(pw))).toBe(pw);
  });
});
