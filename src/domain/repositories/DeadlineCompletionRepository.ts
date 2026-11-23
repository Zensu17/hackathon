export interface DeadlineCompletionRepository {
  listCompletedDeadlineIds(userId: string): Promise<string[]>;
  setDeadlineCompleted(
    userId: string,
    deadlineId: string,
    completed: boolean,
  ): Promise<boolean>;
}
