import { describe, expect, it } from 'vitest';
import { hasPdfMagicHeader } from '../../domain/rules';
import { buildSampleStudyPdf } from '../../data/local/samplePdf';
import {
  domainUserToLocal,
  localUserToDomain,
  remoteProfileToDomain,
  type RemoteProfileRow,
} from '../../data/mappers/userMapper';
import type { User } from '../../domain/entities';

describe('Sample PDF generator and user mappers', () => {
  it('generates a valid PDF 1.4 byte buffer with xref table and EOF marker', () => {
    // Arrange / Act
    const bytes = buildSampleStudyPdf({
      title: 'Binary Search Trees',
      courseLabel: 'IF1101 - Algorithms',
      fileName: 'bst.pdf',
      summary: 'In-order traversal and balanced heights.',
    });
    const text = new TextDecoder().decode(bytes);

    // Assert
    expect(hasPdfMagicHeader(bytes)).toBe(true);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text).toContain('\nxref\n');
    expect(text).toContain('trailer\n');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('Course: IF1101 - Algorithms');
    expect(text).toContain('File: bst.pdf');
  });

  it('escapes PDF control characters and strips non-ASCII bytes cleanly', () => {
    // Arrange / Act
    const bytes = buildSampleStudyPdf({
      title: 'Proof (Case \\1) \u2014 Notes',
      courseLabel: 'MA101',
      fileName: 'proof.pdf',
      summary: 'Check (a) and (b) \\ done',
    });
    const text = new TextDecoder().decode(bytes);

    // Assert
    expect(text).toContain('\\(Case \\\\1\\)');
    expect(text).toContain('Check \\(a\\) and \\(b\\) \\\\ done');
    expect(text).not.toContain('\u2014');
  });

  it('falls back to default offline note text when summary is blank and wraps long lines', () => {
    // Arrange
    const longTitle =
      'Introduction to Distributed Systems Consensus Algorithms and Dormitory Offline First Synchronization Architecture';

    // Act
    const bytes = buildSampleStudyPdf({
      title: longTitle,
      courseLabel: 'CS301',
      fileName: 'dist.pdf',
      summary: '',
    });
    const text = new TextDecoder().decode(bytes);

    // Assert
    expect(text).toContain(
      'Offline study notes stored locally in IndexedDB.',
    );
    // Wrapped title splits across multiple text lines rather than exceeding line width.
    expect(text).toContain('T* (Introduction to Distributed Systems');
    expect(text).not.toContain(`(${longTitle})`);
  });

  it('round-trips domain User through domainUserToLocal and localUserToDomain without loss', () => {
    // Arrange
    const user: User = {
      id: 'user-1',
      nim: '11S22001',
      displayName: 'Student One',
      classId: 'class-1',
      role: 'student',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
      deletedAt: null,
    };

    // Act
    const local = domainUserToLocal(user);
    const roundTripped = localUserToDomain(local);

    // Assert
    expect(roundTripped).toEqual(user);
  });

  it('maps valid remote profile roles (student and rep) accurately', () => {
    // Arrange
    const repRow: RemoteProfileRow = {
      id: 'rep-1',
      nim: '11S22002',
      display_name: 'Class Rep',
      class_id: 'class-1',
      role: 'rep',
      created_at: '2026-11-01T08:00:00.000Z',
      updated_at: '2026-11-02T08:00:00.000Z',
      deleted_at: null,
    };

    // Act
    const mapped = remoteProfileToDomain(repRow);

    // Assert
    expect(mapped).toEqual({
      id: 'rep-1',
      nim: '11S22002',
      displayName: 'Class Rep',
      classId: 'class-1',
      role: 'rep',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-02T08:00:00.000Z',
      deletedAt: null,
    });
  });

  it('coerces unknown or arbitrary remote role strings to null', () => {
    // Arrange
    const invalidRoleRow: RemoteProfileRow = {
      id: 'user-x',
      nim: '11S22099',
      display_name: 'Unknown Role',
      class_id: null,
      role: 'admin',
      created_at: '2026-11-01T08:00:00.000Z',
      updated_at: '2026-11-01T08:00:00.000Z',
      deleted_at: null,
    };

    // Act
    const mapped = remoteProfileToDomain(invalidRoleRow);

    // Assert
    expect(mapped.role).toBeNull();
  });
});
