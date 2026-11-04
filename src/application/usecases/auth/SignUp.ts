import type { User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import {
  isValidNim,
  isValidPassword,
  normalizeNim,
} from '../../../domain/rules';
import type { SignUpInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

export class SignUp {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: SignUpInput): Promise<User> {
    const rawNim = input.nim ?? '';
    const nim = normalizeNim(rawNim);
    const displayName = (input.displayName ?? '').trim();
    const password = input.password ?? '';
    const confirmPassword = input.confirmPassword;
    const classCode = (input.classCode ?? '').trim().toUpperCase();

    if (!isValidNim(nim)) {
      throw new AppError(
        'INVALID_NIM_FORMAT',
        'Enter a valid IT Del NIM (e.g. 11S22001).',
      );
    }

    if (displayName.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Display name is required.');
    }

    if (!isValidPassword(password)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters.',
      );
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      throw new AppError('PASSWORD_MISMATCH', 'Passwords do not match.');
    }

    if (classCode.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Class code is required.');
    }

    try {
      return await this.authRepository.signUp({
        nim,
        displayName,
        password,
        classCode,
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
