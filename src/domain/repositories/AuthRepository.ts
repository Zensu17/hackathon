import type { User } from '../entities/User';

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

export interface AuthRepository {
  signUp(input: SignUpCredentials): Promise<User>;
  signIn(input: SignInCredentials): Promise<User>;
  signOut(options?: SignOutOptions): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
