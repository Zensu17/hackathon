import { describe, expect, it } from 'vitest';
import { AppError } from '../../application/errors/AppError';
import {
  CreateClass,
  GetCurrentUser,
  JoinClass,
  SignIn,
  SignOut,
  SignUp,
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
});
