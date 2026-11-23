import type { DeadlineCompletionRepository } from '../../../domain/repositories/DeadlineCompletionRepository';
import { AppError } from '../../errors/AppError';

export interface ToggleDeadlineCompletionInput {
  userId: string;
  deadlineId: string;
  completed?: boolean;
}

export class ToggleDeadlineCompletion {
  constructor(
    private readonly completionRepository: DeadlineCompletionRepository,
  ) {}

  async execute(input: ToggleDeadlineCompletionInput): Promise<boolean> {
    const userId = input.userId.trim();
    const deadlineId = input.deadlineId.trim();

    if (userId.length === 0 || deadlineId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'User ID and deadline ID are required.',
      );
    }

    if (typeof input.completed === 'boolean') {
      return this.completionRepository.setDeadlineCompleted(
        userId,
        deadlineId,
        input.completed,
      );
    }

    const currentIds =
      await this.completionRepository.listCompletedDeadlineIds(userId);
    const nextCompleted = !currentIds.includes(deadlineId);
    return this.completionRepository.setDeadlineCompleted(
      userId,
      deadlineId,
      nextCompleted,
    );
  }
}
