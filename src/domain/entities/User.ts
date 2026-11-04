export type UserRole = 'student' | 'rep';

export interface User {
  id: string;
  email: string;
  displayName: string;
  classId: string | null;
  role: UserRole | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
