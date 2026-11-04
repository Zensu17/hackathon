import type { User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import { isValidNim, normalizeNim } from '../../../domain/rules';
import type { SignInInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

export class SignIn {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: SignInInput): Promise<User> {
    const rawNim = input.nim ?? '';
    const nim = normalizeNim(rawNim);
    const password = input.password ?? '';

    if (nim.length === 0 || password.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'NIM and password are required.',
      );
    }

    if (!isValidNim(nim)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Enter a valid IT Del NIM (e.g. 11S22001).',
      );
    }

    try {
      return await this.authRepository.signIn({ nim, password });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'AUTH_ERROR',
        'NIM or password is incorrect.',
      );
    }
  }
}
