import type { Class, User, UserRole } from '../../domain/entities';
import type { ClassOnboardingResult } from '../../domain/repositories';

export interface SignUpInput {
  nim: string;
  displayName: string;
  password: string;
  confirmPassword?: string;
  classCode: string;
}

export interface SignInInput {
  nim: string;
  password: string;
}

export interface UpdateProfileInput {
  userId: string;
  displayName: string;
  studyProgram?: string;
  bio?: string;
  avatarColor?: string;
  avatarDataUrl?: string | null;
}

export interface AdminCreateUserDto {
  actorId: string;
  nim: string;
  displayName: string;
  password: string;
  confirmPassword?: string;
  role: UserRole;
  classId: string | null;
  studyProgram?: string;
}

export interface AdminUpdateUserDto {
  actorId: string;
  targetUserId: string;
  displayName?: string;
  role?: UserRole;
  classId?: string | null;
  studyProgram?: string;
  bio?: string;
}

export interface AdminSetUserActiveDto {
  actorId: string;
  targetUserId: string;
  active: boolean;
}

export interface AdminResetPasswordDto {
  actorId: string;
  targetUserId: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface AdminCreateClassDto {
  actorId: string;
  name: string;
  joinCode?: string;
}

export interface ChangeOwnPasswordDto {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
}

export interface AuthSessionDto {
  user: User;
  currentClass: Class | null;
}

export interface JoinClassInput {
  userId: string;
  joinCode: string;
}

export interface CreateClassInput {
  userId: string;
  name: string;
  joinCode?: string;
}

export type { ClassOnboardingResult };
