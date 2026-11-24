import { describe, expect, it } from 'vitest';
import { UpdateUserProfile } from '../../application/usecases';
import {
  MANAGEMENT_ROLES,
  USER_ROLES,
  canManageClassContent,
  isAdminRole,
  isValidUserRole,
} from '../../domain/rules';
import { getRoleLabel, getRoleSummary } from '../../presentation/utils/formatters';
import { createFakeRepositories } from '../application/fakes/FakeRepositories';

describe('Role rules, role formatters, and UpdateUserProfile', () => {
  it('validates user roles, management permissions, and admin privileges cleanly', () => {
    // Arrange / Act / Assert
    expect(USER_ROLES).toEqual([
      'student',
      'rep',
      'lecturer',
      'assistant',
      'admin',
    ]);
    expect(MANAGEMENT_ROLES).toEqual(['rep', 'lecturer', 'assistant', 'admin']);

    for (const role of USER_ROLES) {
      expect(isValidUserRole(role)).toBe(true);
    }
    expect(isValidUserRole('guest')).toBe(false);
    expect(isValidUserRole('')).toBe(false);
    expect(isValidUserRole(null)).toBe(false);
    expect(isValidUserRole(undefined)).toBe(false);
    expect(isValidUserRole(123)).toBe(false);

    expect(canManageClassContent('student')).toBe(false);
    expect(canManageClassContent(null)).toBe(false);
    expect(canManageClassContent(undefined)).toBe(false);
    expect(canManageClassContent('rep')).toBe(true);
    expect(canManageClassContent('lecturer')).toBe(true);
    expect(canManageClassContent('assistant')).toBe(true);
    expect(canManageClassContent('admin')).toBe(true);

    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('rep')).toBe(false);
    expect(isAdminRole('student')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it('formats role labels and role summaries for every supported role', () => {
    // Arrange / Act / Assert
    expect(getRoleLabel('student')).toBe('Student');
    expect(getRoleLabel('rep')).toBe('Class Representative');
    expect(getRoleLabel('lecturer')).toBe('Lecturer (Dosen)');
    expect(getRoleLabel('assistant')).toBe('Teaching Assistant');
    expect(getRoleLabel('admin')).toBe('Admin');
    expect(getRoleLabel(null)).toBe('No class joined yet');
    expect(getRoleLabel(undefined)).toBe('No class joined yet');

    const summaries = USER_ROLES.map((role) => getRoleSummary(role));
    expect(summaries.every((s) => s.trim().length > 10)).toBe(true);
    expect(new Set(summaries).size).toBe(USER_ROLES.length);
  });

  it('rejects invalid UpdateUserProfile inputs including SVG XSS data URLs and oversized fields', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const user = await repos.auth.signUp({
      nim: '11S22001',
      password: 'password123',
      displayName: 'Student One',
      classCode: '',
    });
    const updateProfile = new UpdateUserProfile(repos.auth);

    // Act / Assert
    await expect(
      updateProfile.execute({ userId: ' ', displayName: 'Valid' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({ userId: user.id, displayName: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({ userId: user.id, displayName: 'A'.repeat(81) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        studyProgram: 'B'.repeat(81),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        bio: 'C'.repeat(241),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        avatarColor: 'red',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        avatarColor: '#123',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Reject SVG data URL (XSS vector)
    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        avatarDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Reject oversized PNG data URL
    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        avatarDataUrl: `data:image/png;base64,${'A'.repeat(120_005)}`,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateProfile.execute({
        userId: user.id,
        displayName: 'Valid Name',
        role: 'superadmin' as never,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('trims profile fields, persists valid avatar images, and clears avatarDataUrl when empty', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const user = await repos.auth.signUp({
      nim: '11S22002',
      password: 'password123',
      displayName: 'Student Two',
      classCode: '',
    });
    const updateProfile = new UpdateUserProfile(repos.auth);
    const samplePng = 'data:image/png;base64,iVBORw0KGgo=';

    // Act 1: Save trimmed profile + PNG avatar + role
    const updated = await updateProfile.execute({
      userId: user.id,
      displayName: '  Albert Damian  ',
      studyProgram: '  S1 Informatika  ',
      bio: '  Studying offline in dorm.  ',
      avatarColor: '#1E3A8A',
      avatarDataUrl: samplePng,
      role: 'lecturer',
    });

    // Assert 1
    expect(updated.displayName).toBe('Albert Damian');
    expect(updated.studyProgram).toBe('S1 Informatika');
    expect(updated.bio).toBe('Studying offline in dorm.');
    expect(updated.avatarColor).toBe('#1E3A8A');
    expect(updated.avatarDataUrl).toBe(samplePng);
    expect(updated.role).toBe('lecturer');

    // Act 2: Clear avatar with empty string
    const cleared = await updateProfile.execute({
      userId: user.id,
      displayName: 'Albert Damian',
      avatarDataUrl: '',
    });

    // Assert 2
    expect(cleared.avatarDataUrl).toBeNull();
  });
});
