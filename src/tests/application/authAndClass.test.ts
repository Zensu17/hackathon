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
  it('signs up valid IT Del campus emails and trims input fields', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);

    const user = await signUp.execute({
      email: '  student01@students.del.ac.id  ',
      password: 'password123',
      displayName: '  Student One  ',
    });

    expect(user.email).toBe('student01@students.del.ac.id');
    expect(user.displayName).toBe('Student One');
    expect(user.classId).toBeNull();
    expect(user.role).toBeNull();
  });

  it('supports custom injected allowed domains in SignUp', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth, ['campus.test']);

    const user = await signUp.execute({
      email: 'learner@campus.test',
      password: 'password123',
      displayName: 'Student Two',
    });

    expect(user.email).toBe('learner@campus.test');
  });

  it('rejects non-campus email domains with INVALID_EMAIL_DOMAIN', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);

    await expect(
      signUp.execute({
        email: 'person@gmail.com',
        password: 'password123',
        displayName: 'Student One',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_EMAIL_DOMAIN',
    });
  });

  it('rejects blank display names and short passwords in SignUp with VALIDATION_ERROR', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);

    await expect(
      signUp.execute({
        email: 'student01@del.ac.id',
        password: 'password123',
        displayName: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    await expect(
      signUp.execute({
        email: 'student01@del.ac.id',
        password: 'short',
        displayName: 'Student One',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('validates SignIn credentials, clears session on SignOut, and resolves GetCurrentUser with class summary', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);
    const signIn = new SignIn(repos.auth);
    const signOut = new SignOut(repos.auth);
    const createClass = new CreateClass(repos.classes);
    const getCurrentUser = new GetCurrentUser(repos.auth, repos.classes);

    await expect(
      signIn.execute({ email: '', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const created = await signUp.execute({
      email: 'rep01@del.ac.id',
      password: 'password123',
      displayName: 'Rep One',
    });

    const sessionBeforeClass = await getCurrentUser.execute();
    expect(sessionBeforeClass).toEqual({
      user: created,
      currentClass: null,
    });

    const onboarding = await createClass.execute({
      userId: created.id,
      name: 'Class A',
      joinCode: 'classa',
    });

    const sessionWithClass = await getCurrentUser.execute();
    expect(sessionWithClass?.user.role).toBe('rep');
    expect(sessionWithClass?.currentClass?.id).toBe(onboarding.currentClass.id);
    expect(sessionWithClass?.currentClass?.joinCode).toBe('CLASSA');

    await signOut.execute();
    expect(await getCurrentUser.execute()).toBeNull();

    const signedInAgain = await signIn.execute({
      email: '  REP01@del.ac.id ',
      password: 'password123',
    });
    expect(signedInAgain.id).toBe(created.id);
  });

  it('creates a class with generated 6-char code when custom joinCode is blank and blocks collisions', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);
    const createClass = new CreateClass(repos.classes);

    const repOne = await signUp.execute({
      email: 'rep01@students.del.ac.id',
      password: 'password123',
      displayName: 'Rep One',
    });

    const generated = await createClass.execute({
      userId: repOne.id,
      name: '  Class A  ',
      joinCode: '   ',
    });

    expect(generated.currentClass.name).toBe('Class A');
    expect(generated.currentClass.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(generated.user.role).toBe('rep');
    expect(generated.user.classId).toBe(generated.currentClass.id);

    const repTwo = await signUp.execute({
      email: 'rep02@students.del.ac.id',
      password: 'password123',
      displayName: 'Rep Two',
    });

    await expect(
      createClass.execute({
        userId: repTwo.id,
        name: 'Class B',
        joinCode: generated.currentClass.joinCode.toLowerCase(),
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_JOIN_CODE',
    });

    await expect(
      createClass.execute({
        userId: repTwo.id,
        name: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    await expect(
      createClass.execute({
        userId: repTwo.id,
        name: 'Class B',
        joinCode: 'BAD CODE!',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('normalizes joinCode on JoinClass, assigns student role, and surfaces NOT_FOUND on unknown code', async () => {
    const repos = createFakeRepositories();
    const signUp = new SignUp(repos.auth);
    const createClass = new CreateClass(repos.classes);
    const joinClass = new JoinClass(repos.classes);

    const rep = await signUp.execute({
      email: 'rep01@del.ac.id',
      password: 'password123',
      displayName: 'Rep One',
    });
    const createdClass = await createClass.execute({
      userId: rep.id,
      name: 'Class A',
      joinCode: 'if2026',
    });

    const student = await signUp.execute({
      email: 'student01@students.del.ac.id',
      password: 'password123',
      displayName: 'Student One',
    });

    await expect(
      joinClass.execute({ userId: student.id, joinCode: '   ' }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      joinClass.execute({ userId: student.id, joinCode: 'missing' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const joined = await joinClass.execute({
      userId: student.id,
      joinCode: '  if2026 ',
    });

    expect(joined.user.role).toBe('student');
    expect(joined.user.classId).toBe(createdClass.currentClass.id);
    expect(joined.currentClass.joinCode).toBe('IF2026');
  });
});
