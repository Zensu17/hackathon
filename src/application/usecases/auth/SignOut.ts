import type { AuthRepository } from '../../../domain/repositories';
import { AppError, isAppError } from '../../errors/AppError';

export class SignOut {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(): Promise<void> {
    try {
      await this.authRepository.signOut();
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'AUTH_ERROR',
        error instanceof Error ? error.message : 'Could not sign out.',
      );
    }
  }
}
