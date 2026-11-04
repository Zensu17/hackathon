import type { Class, User } from '../../domain/entities';
import type { ClassOnboardingResult } from '../../domain/repositories';

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInInput {
  email: string;
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
