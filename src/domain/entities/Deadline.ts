export interface Deadline {
  id: string;
  courseId: string;
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
