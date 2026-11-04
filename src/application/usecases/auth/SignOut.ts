import type {
  AuthRepository,
  SignOutOptions,
} from '../../../domain/repositories';
import { AppError, isAppError } from '../../errors/AppError';

export class SignOut {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(options?: SignOutOptions): Promise<void> {
    try {
      await this.authRepository.signOut(options);
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
