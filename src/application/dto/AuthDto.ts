import type { Class, User } from '../../domain/entities';
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
