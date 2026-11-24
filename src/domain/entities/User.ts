export type UserRole = 'student' | 'rep' | 'lecturer' | 'assistant' | 'admin';

export interface User {
  id: string;
  nim: string;
  displayName: string;
  classId: string | null;
  role: UserRole | null;
  studyProgram?: string;
  bio?: string;
  avatarColor?: string;
  avatarDataUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
