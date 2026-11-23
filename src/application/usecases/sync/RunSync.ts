import type { SyncService, SyncStateSummary } from '../../../domain/services';
import type { RunSyncInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class RunSync {
  constructor(private readonly syncService: SyncService) {}

  async execute(input: RunSyncInput): Promise<SyncStateSummary> {
    const userId = input.userId.trim();
    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required to sync.');
    }

    if (input.retryFailed) {
      return this.syncService.retryFailed(userId);
    }

    return this.syncService.syncNow(userId);
  }
}
