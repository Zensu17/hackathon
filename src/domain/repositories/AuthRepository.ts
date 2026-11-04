import type { User } from '../entities/User';

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthRepository {
  signUp(input: SignUpCredentials): Promise<User>;
  signIn(input: SignInCredentials): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
