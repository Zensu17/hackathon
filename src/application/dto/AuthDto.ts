import type { Class, User, UserRole } from '../../domain/entities';
import type { ClassOnboardingResult } from '../../domain/repositories';

export interface SignUpInput {
  nim: string;
  displayName: string;
  password: string;
  confirmPassword?: string;
  classCode: string;
  role?: UserRole;
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
  role?: UserRole;
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
