import { describe, expect, it } from 'vitest';
import { AppError } from '../../application/errors/AppError';
import {
  AdminCreateClass,
  AdminCreateUser,
  AdminResetPassword,
  AdminSetUserActive,
  AdminUpdateUser,
  ChangeOwnPassword,
  CreateClass,
  GetCurrentUser,
  JoinClass,
  SignIn,
  SignOut,
  SignUp,
  UpdateUserProfile,
} from '../../application/usecases';
import { createFakeRepositories } from './fakes/FakeRepositories';

describe('Auth and class onboarding use cases', () => {
  it('signs up valid IT Del NIM and trims/normalizes input fields', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const signUp = new SignUp(repos.auth);

    // Seed rep user who created the class
    repos.users.set('setup-user', {
      id: 'setup-user',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    repos.users.set('setup-user', {
      id: 'setup-user',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    await createClass.execute({
      userId: 'setup-user',
      name: 'Class A',
      joinCode: 'CLASSA',
    });

    const user = await signUp.execute({
      nim: '  11s22001  ',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: '  Student One  ',
      classCode: '  classa ',
    });

    expect(user.nim).toBe('11S22001');
    expect(user.displayName).toBe('Student One');
    expect(user.role).toBe('student');
    expect(user.classId).toBeDefined();
  });

  it('rejects invalid NIM formats with INVALID_NIM_FORMAT', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);

    await expect(
      signUp.execute({
        nim: '12345678', // digits only
        password: 'password123',
        displayName: 'Student One',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_NIM_FORMAT',
    });

    await expect(
      signUp.execute({
        nim: '11S2200', // too short
        password: 'password123',
        displayName: 'Student One',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_NIM_FORMAT',
    });
  });

  it('rejects duplicate NIM registration with DUPLICATE_NIM and helpful message', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const signUp = new SignUp(repos.auth);

    repos.users.set('setup-user', {
      id: 'setup-user',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    await createClass.execute({
      userId: 'setup-user',
      name: 'Class A',
      joinCode: 'CLASSA',
    });

    await signUp.execute({
      nim: '11S22001',
      password: 'password123',
      displayName: 'Student One',
      classCode: 'CLASSA',
    });

    await expect(
      signUp.execute({
        nim: '11s22001',
        password: 'password456',
        displayName: 'Student Duplicate',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_NIM',
      message: 'This NIM is already registered. Try signing in.',
    });
  });

  it('rejects password mismatch and short passwords with validation errors', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);

    await expect(
      signUp.execute({
        nim: '11S22001',
        password: 'password123',
        confirmPassword: 'differentPassword',
        displayName: 'Student One',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({
      code: 'PASSWORD_MISMATCH',
    });

    await expect(
      signUp.execute({
        nim: '11S22001',
        password: 'short',
        displayName: 'Student One',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('validates SignIn credentials, clears session on SignOut, and hides NIM existence on wrong credentials', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const signUp = new SignUp(repos.auth);
    const signIn = new SignIn(repos.auth);
    const signOut = new SignOut(repos.auth);
    const getCurrentUser = new GetCurrentUser(repos.auth, repos.classes);

    repos.users.set('setup-user', {
      id: 'setup-user',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    await createClass.execute({
      userId: 'setup-user',
      name: 'Class A',
      joinCode: 'CLASSA',
    });

    await expect(
      signIn.execute({ nim: '', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const created = await signUp.execute({
      nim: '11S22001',
      password: 'password123',
      displayName: 'Student One',
      classCode: 'CLASSA',
    });

    const session = await getCurrentUser.execute();
    expect(session?.user.nim).toBe('11S22001');
    expect(session?.currentClass?.joinCode).toBe('CLASSA');

    await signOut.execute();
    expect(await getCurrentUser.execute()).toBeNull();

    // Wrong password -> generic error
    await expect(
      signIn.execute({
        nim: '11S22001',
        password: 'wrongPassword',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_ERROR',
      message: 'NIM or password is incorrect.',
    });

    // Unregistered NIM -> generic error (does not reveal existence)
    await expect(
      signIn.execute({
        nim: '14S22099',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_ERROR',
      message: 'NIM or password is incorrect.',
    });

    // Correct sign in
    const signedInAgain = await signIn.execute({
      nim: '  11s22001 ',
      password: 'password123',
    });
    expect(signedInAgain.id).toBe(created.id);
    expect(signedInAgain.nim).toBe('11S22001');
  });

  it('supports sign out and clearing local data', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const signUp = new SignUp(repos.auth);
    const signOut = new SignOut(repos.auth);
    const getCurrentUser = new GetCurrentUser(repos.auth, repos.classes);

    repos.users.set('setup-user', {
      id: 'setup-user',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    await createClass.execute({
      userId: 'setup-user',
      name: 'Class A',
      joinCode: 'CLASSA',
    });

    await signUp.execute({
      nim: '11S22002',
      password: 'password123',
      displayName: 'Student Two',
      classCode: 'CLASSA',
    });

    expect(await getCurrentUser.execute()).not.toBeNull();

    await signOut.execute({ clearLocalData: true });
    expect(await getCurrentUser.execute()).toBeNull();
  });

  it('creates a class with generated 6-char code when custom joinCode is blank and blocks collisions', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);

    repos.users.set('user-rep-1', {
      id: 'user-rep-1',
      nim: '11S22091',
      displayName: 'Rep One',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    repos.users.set('user-rep-2', {
      id: 'user-rep-2',
      nim: '11S22092',
      displayName: 'Rep Two',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });

    const generated = await createClass.execute({
      userId: 'user-rep-1',
      name: '  Class A  ',
      joinCode: '   ',
    });

    expect(generated.currentClass.name).toBe('Class A');
    expect(generated.currentClass.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(generated.user.role).toBe('rep');
    expect(generated.user.classId).toBe(generated.currentClass.id);

    await expect(
      createClass.execute({
        userId: 'user-rep-2',
        name: 'Class B',
        joinCode: generated.currentClass.joinCode.toLowerCase(),
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_JOIN_CODE',
    });

    await expect(
      createClass.execute({
        userId: 'user-rep-2',
        name: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    await expect(
      createClass.execute({
        userId: 'user-rep-2',
        name: 'Class B',
        joinCode: 'BAD CODE!',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('normalizes joinCode on JoinClass, assigns student role, and surfaces NOT_FOUND on unknown code', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const joinClass = new JoinClass(repos.classes);

    repos.users.set('user-rep', {
      id: 'user-rep',
      nim: '11S22093',
      displayName: 'Rep Host',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });

    const createdClass = await createClass.execute({
      userId: 'user-rep',
      name: 'Class A',
      joinCode: 'if-2026',
    });

    // Dummy user for join test
    repos.users.set('user-student-1', {
      id: 'user-student-1',
      nim: '11S22003',
      displayName: 'Student Three',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });

    await expect(
      joinClass.execute({ userId: 'user-student-1', joinCode: '   ' }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      joinClass.execute({ userId: 'user-student-1', joinCode: 'missing' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const joined = await joinClass.execute({
      userId: 'user-student-1',
      joinCode: '  if-2026 ',
    });

    expect(joined.user.role).toBe('student');
    expect(joined.user.classId).toBe(createdClass.currentClass.id);
    expect(joined.currentClass.joinCode).toBe('IF-2026');
  });

  it('always registers new users as student and delegates role and account administration to Admin use cases', async () => {
    const repos = createFakeRepositories();
    const createClass = new CreateClass(repos.classes);
    const signUp = new SignUp(repos.auth);
    const signIn = new SignIn(repos.auth);
    const updateProfile = new UpdateUserProfile(repos.auth);
    const adminCreateUser = new AdminCreateUser(repos.auth);
    const adminUpdateUser = new AdminUpdateUser(repos.auth);
    const adminSetUserActive = new AdminSetUserActive(repos.auth);
    const adminResetPassword = new AdminResetPassword(repos.auth);
    const adminCreateClass = new AdminCreateClass(repos.auth);
    const changeOwnPassword = new ChangeOwnPassword(repos.auth);

    repos.users.set('setup-admin', {
      id: 'setup-admin',
      nim: '00A00001',
      displayName: 'Academic Admin',
      classId: null,
      role: null,
      createdAt: '2026-11-04T08:00:00.000Z',
      updatedAt: '2026-11-04T08:00:00.000Z',
      deletedAt: null,
    });
    const classResult = await createClass.execute({
      userId: 'setup-admin',
      name: 'Class A',
      joinCode: 'CLASSA',
    });
    // Promote setup-admin to Admin
    const adminUser = { ...classResult.user, role: 'admin' as const };
    repos.users.set(adminUser.id, adminUser);

    // Self-registration always assigns student role
    const student = await signUp.execute({
      nim: '11S25010',
      displayName: 'New Student',
      password: 'password123',
      confirmPassword: 'password123',
      classCode: 'CLASSA',
    });
    expect(student.role).toBe('student');

    // User can customize their own profile details without altering role
    await expect(
      updateProfile.execute({
        userId: student.id,
        displayName: 'New Student Updated',
        avatarColor: 'not-a-hex',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const customized = await updateProfile.execute({
      userId: student.id,
      displayName: 'New Student Updated',
      studyProgram: 'S1 Informatika',
      bio: 'Algorithms student',
      avatarColor: '#0F766E',
      avatarDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(customized.studyProgram).toBe('S1 Informatika');
    expect(customized.bio).toBe('Algorithms student');
    expect(customized.role).toBe('student');

    // Non-admin cannot invoke admin user creation or role management
    await expect(
      adminUpdateUser.execute({
        actorId: student.id,
        targetUserId: student.id,
        role: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

    // Admin creates a new class and a lecturer account directly
    const secondClass = await adminCreateClass.execute({
      actorId: adminUser.id,
      name: 'Class B',
      joinCode: 'CLASSB',
    });
    expect(secondClass.joinCode).toBe('CLASSB');
    expect(repos.users.get(adminUser.id)?.role).toBe('admin');

    const lecturer = await adminCreateUser.execute({
      actorId: adminUser.id,
      nim: '01D10002',
      displayName: 'Dr. Togar Simanjuntak',
      password: 'password123',
      role: 'lecturer',
      classId: secondClass.id,
      studyProgram: 'Faculty of Informatics',
    });
    expect(lecturer.role).toBe('lecturer');
    expect(lecturer.classId).toBe(secondClass.id);

    // Admin promotes student to assistant and reassigns class
    const promoted = await adminUpdateUser.execute({
      actorId: adminUser.id,
      targetUserId: student.id,
      role: 'assistant',
      classId: secondClass.id,
    });
    expect(promoted.role).toBe('assistant');
    expect(promoted.classId).toBe(secondClass.id);

    // Last-admin protection prevents demoting or self-deactivating the sole Admin
    await expect(
      adminUpdateUser.execute({
        actorId: adminUser.id,
        targetUserId: adminUser.id,
        role: 'student',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

    await expect(
      adminSetUserActive.execute({
        actorId: adminUser.id,
        targetUserId: adminUser.id,
        active: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

    // Admin resets lecturer password & user updates own password
    await adminResetPassword.execute({
      actorId: adminUser.id,
      targetUserId: lecturer.id,
      newPassword: 'newpassword1',
    });
    const signedLecturer = await signIn.execute({
      nim: '01D10002',
      password: 'newpassword1',
    });
    expect(signedLecturer.id).toBe(lecturer.id);

    await expect(
      changeOwnPassword.execute({
        userId: lecturer.id,
        currentPassword: 'wrongpassword',
        newPassword: 'finalpassword2',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_ERROR' });

    await changeOwnPassword.execute({
      userId: lecturer.id,
      currentPassword: 'newpassword1',
      newPassword: 'finalpassword2',
      confirmNewPassword: 'finalpassword2',
    });
    await signIn.execute({ nim: '01D10002', password: 'finalpassword2' });

    // Admin can deactivate and restore another user
    const deactivated = await adminSetUserActive.execute({
      actorId: adminUser.id,
      targetUserId: lecturer.id,
      active: false,
    });
    expect(deactivated.deletedAt).not.toBeNull();
    await expect(
      signIn.execute({ nim: '01D10002', password: 'finalpassword2' }),
    ).rejects.toMatchObject({ code: 'AUTH_ERROR' });

    const restored = await adminSetUserActive.execute({
      actorId: adminUser.id,
      targetUserId: lecturer.id,
      active: true,
    });
    expect(restored.deletedAt).toBeNull();
    await signIn.execute({ nim: '01D10002', password: 'finalpassword2' });
  });
});
