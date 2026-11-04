import type {
  ClassOnboardingResult,
  ClassRepository,
} from '../../../domain/repositories';
import type { JoinClassInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

export class JoinClass {
  constructor(private readonly classRepository: ClassRepository) {}

  async execute(input: JoinClassInput): Promise<ClassOnboardingResult> {
    const userId = input.userId.trim();
    const joinCode = input.joinCode.trim().toUpperCase();

    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    if (joinCode.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Class join code is required.');
    }

    try {
      return await this.classRepository.joinByCode(userId, joinCode);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Could not join class.';
      if (/not\s*found|p0002|no class/i.test(message)) {
        throw new AppError('NOT_FOUND', message);
      }
      throw new AppError('STORAGE_ERROR', message);
    }
  }
}
