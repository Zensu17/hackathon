import type { User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import {
  DEFAULT_ALLOWED_CAMPUS_DOMAINS,
  isAllowedCampusEmail,
} from '../../../domain/rules';
import type { SignUpInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

const MIN_PASSWORD_LENGTH = 8;

export class SignUp {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly allowedDomains: readonly string[] = DEFAULT_ALLOWED_CAMPUS_DOMAINS,
  ) {}

  async execute(input: SignUpInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const password = input.password;

    if (displayName.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Full name is required.');
    }

    if (email.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Campus email is required.');
    }

    if (!isAllowedCampusEmail(email, this.allowedDomains)) {
      throw new AppError(
        'INVALID_EMAIL_DOMAIN',
        'Email must belong to an allowed campus domain.',
      );
    }

    if (password.trim().length === 0 || password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters.',
      );
    }

    try {
      return await this.authRepository.signUp({
        email,
        password,
        displayName,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'AUTH_ERROR',
        error instanceof Error ? error.message : 'Could not create account.',
      );
    }
  }
}
