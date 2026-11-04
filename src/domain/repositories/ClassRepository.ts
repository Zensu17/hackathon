import type { Class } from '../entities/Class';
import type { User } from '../entities/User';

export interface ClassOnboardingResult {
  user: User;
  currentClass: Class;
}

export interface CreateClassForRepInput {
  name: string;
  joinCode: string;
}

// Class onboarding updates class membership and user role atomically inside a single repository call.
export interface ClassRepository {
  getById(id: string): Promise<Class | null>;
  joinByCode(userId: string, joinCode: string): Promise<ClassOnboardingResult>;
  createForRep(
    userId: string,
    input: CreateClassForRepInput,
  ): Promise<ClassOnboardingResult>;
}
