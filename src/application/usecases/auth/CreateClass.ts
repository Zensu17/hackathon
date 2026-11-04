import type {
  ClassOnboardingResult,
  ClassRepository,
} from '../../../domain/repositories';
import type { CreateClassInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

const JOIN_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,14}[A-Z0-9]$/;
const GENERATED_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GENERATED_CODE_LENGTH = 6;

function generateSixCharJoinCode(): string {
  let out = '';
  for (let i = 0; i < GENERATED_CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * GENERATED_CODE_ALPHABET.length);
    out += GENERATED_CODE_ALPHABET[idx] ?? 'A';
  }
  return out;
}

export class CreateClass {
  constructor(
    private readonly classRepository: ClassRepository,
    private readonly codeGenerator: () => string = generateSixCharJoinCode,
  ) {}

  async execute(input: CreateClassInput): Promise<ClassOnboardingResult> {
    const userId = input.userId.trim();
    const name = input.name.trim();
    const rawCustomCode = input.joinCode?.trim() ?? '';

    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    if (name.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Class name is required.');
    }

    let joinCode: string;
    if (rawCustomCode.length === 0) {
      joinCode = this.codeGenerator().trim().toUpperCase();
    } else {
      joinCode = rawCustomCode.toUpperCase();
      if (!JOIN_CODE_PATTERN.test(joinCode)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Join code must be 3 to 16 uppercase letters, digits, or internal hyphens.',
        );
      }
    }

    try {
      return await this.classRepository.createForRep(userId, {
        name,
        joinCode,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Could not create class.';
      if (/duplicate|unique|23505|already/i.test(message)) {
        throw new AppError('DUPLICATE_JOIN_CODE', message);
      }
      throw new AppError('STORAGE_ERROR', message);
    }
  }
}
