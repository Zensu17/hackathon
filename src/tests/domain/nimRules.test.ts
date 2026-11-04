import { describe, expect, it } from 'vitest';
import {
  isValidNim,
  isValidPassword,
  normalizeNim,
} from '../../domain/rules/nimRules';

describe('nimRules', () => {
  describe('normalizeNim', () => {
    it('trims leading/trailing whitespace and uppercases letters', () => {
      expect(normalizeNim('  11s22001  ')).toBe('11S22001');
      expect(normalizeNim('14s22045')).toBe('14S22045');
    });
  });

  describe('isValidNim', () => {
    it('accepts valid 8-character IT Del NIM formats (2 digits + 1 letter + 5 digits)', () => {
      expect(isValidNim('11S22001')).toBe(true);
      expect(isValidNim('14S22045')).toBe(true);
      expect(isValidNim('21S20012')).toBe(true);
      expect(isValidNim('  11s22001  ')).toBe(true);
      expect(isValidNim('12j21001')).toBe(true);
    });

    it('rejects NIMs with invalid length', () => {
      expect(isValidNim('11S2200')).toBe(false); // 7 chars
      expect(isValidNim('11S220001')).toBe(false); // 9 chars
      expect(isValidNim('')).toBe(false);
      expect(isValidNim('   ')).toBe(false);
    });

    it('rejects NIMs with letters in invalid positions', () => {
      expect(isValidNim('S1122001')).toBe(false);
      expect(isValidNim('1122001S')).toBe(false);
      expect(isValidNim('11SS2001')).toBe(false);
      expect(isValidNim('11422001')).toBe(false); // digits only
      expect(isValidNim('abcdefgh')).toBe(false);
    });

    it('rejects NIMs with internal whitespace or special characters', () => {
      expect(isValidNim('11S 22001')).toBe(false);
      expect(isValidNim('11S-22001')).toBe(false);
      expect(isValidNim('11S.22001')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('accepts passwords with 8 or more characters', () => {
      expect(isValidPassword('password')).toBe(true);
      expect(isValidPassword('securePass123!')).toBe(true);
      expect(isValidPassword('12345678')).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('short')).toBe(false);
      expect(isValidPassword('1234567')).toBe(false);
    });
  });
});

