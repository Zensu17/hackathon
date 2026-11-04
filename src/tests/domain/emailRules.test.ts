import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_CAMPUS_DOMAINS,
  isAllowedCampusEmail,
  parseAllowedEmailDomains,
} from '../../domain/rules/emailRules';

describe('emailRules', () => {
  describe('parseAllowedEmailDomains', () => {
    it('falls back to IT Del campus domains when raw config is undefined or blank', () => {
      expect(parseAllowedEmailDomains(undefined)).toEqual([...DEFAULT_ALLOWED_CAMPUS_DOMAINS]);
      expect(parseAllowedEmailDomains('')).toEqual([...DEFAULT_ALLOWED_CAMPUS_DOMAINS]);
      expect(parseAllowedEmailDomains('  ,  ')).toEqual([...DEFAULT_ALLOWED_CAMPUS_DOMAINS]);
    });

    it('normalizes comma-separated domains, strips leading @, and lowercases entries', () => {
      expect(
        parseAllowedEmailDomains(' @Students.Del.ac.id , DEL.AC.ID, @test.local '),
      ).toEqual(['students.del.ac.id', 'del.ac.id', 'test.local']);
    });
  });

  describe('isAllowedCampusEmail', () => {
    it('accepts valid @students.del.ac.id and @del.ac.id emails case-insensitively', () => {
      expect(isAllowedCampusEmail('ifs24001@students.del.ac.id')).toBe(true);
      expect(isAllowedCampusEmail('  LECTURER.NAME@DEL.AC.ID  ')).toBe(true);
    });

    it('rejects external email domains', () => {
      expect(isAllowedCampusEmail('student@gmail.com')).toBe(false);
      expect(isAllowedCampusEmail('student@itb.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('student@del.ac.id.evil.com')).toBe(false);
    });

    it('rejects unlisted subdomains to prevent suffix spoofing (T-01-01)', () => {
      expect(isAllowedCampusEmail('student@fake.del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('student@evil.students.del.ac.id')).toBe(false);
    });

    it('rejects malformed addresses and embedded whitespace', () => {
      expect(isAllowedCampusEmail('')).toBe(false);
      expect(isAllowedCampusEmail('student@')).toBe(false);
      expect(isAllowedCampusEmail('@del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('stu dent@students.del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('a@b@students.del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('.leadingdot@del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('trailingdot.@del.ac.id')).toBe(false);
      expect(isAllowedCampusEmail('double..dot@del.ac.id')).toBe(false);
    });

    it('honors custom allowedDomains including @ prefix normalization and * wildcard', () => {
      expect(isAllowedCampusEmail('tester@campus.test', ['@CAMPUS.TEST'])).toBe(true);
      expect(isAllowedCampusEmail('ifs24001@students.del.ac.id', ['campus.test'])).toBe(false);
      expect(isAllowedCampusEmail('dev@anydomain.org', ['*'])).toBe(true);
      expect(isAllowedCampusEmail('malformed@@anydomain.org', ['*'])).toBe(false);
      expect(isAllowedCampusEmail('ifs24001@students.del.ac.id', [])).toBe(false);
    });
  });
});
