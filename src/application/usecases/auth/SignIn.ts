import type { User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import type { SignInInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

export class SignIn {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: SignInInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (email.length === 0 || password.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Email and password are required.',
      );
    }

    try {
      return await this.authRepository.signIn({ email, password });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'AUTH_ERROR',
        error instanceof Error ? error.message : 'Could not sign in.',
      );
    }
  }
}
