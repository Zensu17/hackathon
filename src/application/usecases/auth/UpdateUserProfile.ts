import type { User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import { isValidUserRole } from '../../../domain/rules';
import type { UpdateProfileInput } from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const DATA_URL_IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_DATA_URL_LENGTH = 120_000;

export class UpdateUserProfile {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: UpdateProfileInput): Promise<User> {
    const userId = (input.userId ?? '').trim();
    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    const displayName = (input.displayName ?? '').trim();
    if (displayName.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Display name is required.');
    }
    if (displayName.length > 80) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Display name must be 80 characters or fewer.',
      );
    }

    const studyProgram = input.studyProgram?.trim();
    if (studyProgram !== undefined && studyProgram.length > 80) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Study program must be 80 characters or fewer.',
      );
    }

    const bio = input.bio?.trim();
    if (bio !== undefined && bio.length > 240) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Bio must be 240 characters or fewer.',
      );
    }

    const avatarColor = input.avatarColor?.trim();
    if (
      avatarColor !== undefined &&
      avatarColor.length > 0 &&
      !HEX_COLOR_PATTERN.test(avatarColor)
    ) {
      throw new AppError('VALIDATION_ERROR', 'Choose a valid avatar color.');
    }

    if (
      input.avatarDataUrl !== undefined &&
      input.avatarDataUrl !== null &&
      input.avatarDataUrl.length > 0
    ) {
      if (
        input.avatarDataUrl.length > MAX_AVATAR_DATA_URL_LENGTH ||
        !DATA_URL_IMAGE_PATTERN.test(input.avatarDataUrl)
      ) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Avatar image must be a compact PNG, JPEG, or WebP photo.',
        );
      }
    }

    if (input.role !== undefined && !isValidUserRole(input.role)) {
      throw new AppError('VALIDATION_ERROR', 'Select a valid account role.');
    }

    try {
      return await this.authRepository.updateProfile({
        userId,
        displayName,
        ...(studyProgram !== undefined ? { studyProgram } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarColor !== undefined && avatarColor.length > 0
          ? { avatarColor }
          : {}),
        ...(input.avatarDataUrl !== undefined
          ? {
              avatarDataUrl:
                input.avatarDataUrl && input.avatarDataUrl.length > 0
                  ? input.avatarDataUrl
                  : null,
            }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not update profile.',
      );
    }
  }
}
