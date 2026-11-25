import type { Class } from '../entities/Class';
import type { User, UserRole } from '../entities/User';

export interface SignUpCredentials {
  nim: string;
  displayName: string;
  password: string;
  classCode: string;
}

export interface SignInCredentials {
  nim: string;
  password: string;
}

export interface SignOutOptions {
  clearLocalData?: boolean;
}

export interface UpdateProfileRecordInput {
  userId: string;
  displayName: string;
  studyProgram?: string;
  bio?: string;
  avatarColor?: string;
  avatarDataUrl?: string | null;
}

export interface AdminCreateUserInput {
  actorId: string;
  nim: string;
  displayName: string;
  password: string;
  role: UserRole;
  classId: string | null;
  studyProgram?: string;
}

export interface AdminUpdateUserInput {
  actorId: string;
  targetUserId: string;
  displayName?: string;
  role?: UserRole;
  classId?: string | null;
  studyProgram?: string;
  bio?: string;
}

export interface AdminSetUserActiveInput {
  actorId: string;
  targetUserId: string;
  active: boolean;
}

export interface AdminResetPasswordInput {
  actorId: string;
  targetUserId: string;
  newPassword: string;
}

export interface ChangeOwnPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface AuthRepository {
  signUp(input: SignUpCredentials): Promise<User>;
  signIn(input: SignInCredentials): Promise<User>;
  signOut(options?: SignOutOptions): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  updateProfile(input: UpdateProfileRecordInput): Promise<User>;
  listClassMembers?(classId: string): Promise<User[]>;
  listAllUsers?(actorId: string): Promise<User[]>;
  listAllClasses?(actorId: string): Promise<Class[]>;
  adminCreateUser?(input: AdminCreateUserInput): Promise<User>;
  adminUpdateUser?(input: AdminUpdateUserInput): Promise<User>;
  adminSetUserActive?(input: AdminSetUserActiveInput): Promise<User>;
  adminResetPassword?(input: AdminResetPasswordInput): Promise<void>;
  adminCreateClass?(actorId: string, name: string, joinCode: string): Promise<Class>;
  changeOwnPassword?(input: ChangeOwnPasswordInput): Promise<void>;
}
