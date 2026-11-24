import type { User, UserRole } from '../entities/User';

export interface SignUpCredentials {
  nim: string;
  displayName: string;
  password: string;
  classCode: string;
  role?: UserRole;
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
  role?: UserRole;
}

export interface AuthRepository {
  signUp(input: SignUpCredentials): Promise<User>;
  signIn(input: SignInCredentials): Promise<User>;
  signOut(options?: SignOutOptions): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  updateProfile(input: UpdateProfileRecordInput): Promise<User>;
}
