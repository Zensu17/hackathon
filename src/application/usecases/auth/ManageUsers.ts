import type { Class, User } from '../../../domain/entities';
import type { AuthRepository } from '../../../domain/repositories';
import {
  isValidNim,
  isValidPassword,
  isValidUserRole,
  normalizeNim,
} from '../../../domain/rules';
import type {
  AdminCreateClassDto,
  AdminCreateUserDto,
  AdminResetPasswordDto,
  AdminSetUserActiveDto,
  AdminUpdateUserDto,
  ChangeOwnPasswordDto,
} from '../../dto/AuthDto';
import { AppError, isAppError } from '../../errors/AppError';

const JOIN_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,15}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateClassCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx] ?? 'A';
  }
  return out;
}

export class AdminCreateUser {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: AdminCreateUserDto): Promise<User> {
    const actorId = (input.actorId ?? '').trim();
    const nim = normalizeNim(input.nim ?? '');
    const displayName = (input.displayName ?? '').trim();
    const password = input.password ?? '';
    const studyProgram = input.studyProgram?.trim();

    if (actorId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Admin actor ID is required.');
    }
    if (!isValidNim(nim)) {
      throw new AppError(
        'INVALID_NIM_FORMAT',
        'Enter a valid 8-character ID (2 digits, 1 letter, 5 digits, e.g. 11S22001).',
      );
    }
    if (displayName.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Display name is required.');
    }
    if (displayName.length > 80) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Display name must be 80 characters or fewer.',
      );
    }
    if (!isValidPassword(password)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters.',
      );
    }
    if (
      input.confirmPassword !== undefined &&
      input.confirmPassword !== password
    ) {
      throw new AppError('PASSWORD_MISMATCH', 'Passwords do not match.');
    }
    if (!isValidUserRole(input.role)) {
      throw new AppError('VALIDATION_ERROR', 'Select a valid account role.');
    }
    if (studyProgram !== undefined && studyProgram.length > 80) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Study program must be 80 characters or fewer.',
      );
    }
    if (!this.authRepository.adminCreateUser) {
      throw new AppError('STORAGE_ERROR', 'Admin user creation is unavailable.');
    }

    try {
      return await this.authRepository.adminCreateUser({
        actorId,
        nim,
        displayName,
        password,
        role: input.role,
        classId:
          input.classId && input.classId.trim().length > 0
            ? input.classId.trim()
            : null,
        ...(studyProgram !== undefined ? { studyProgram } : {}),
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not create user account.',
      );
    }
  }
}

export class AdminUpdateUser {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: AdminUpdateUserDto): Promise<User> {
    const actorId = (input.actorId ?? '').trim();
    const targetUserId = (input.targetUserId ?? '').trim();
    if (actorId.length === 0 || targetUserId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Admin actor ID and target user ID are required.',
      );
    }

    let displayName: string | undefined;
    if (input.displayName !== undefined) {
      displayName = input.displayName.trim();
      if (displayName.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Display name is required.');
      }
      if (displayName.length > 80) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Display name must be 80 characters or fewer.',
        );
      }
    }

    if (input.role !== undefined && !isValidUserRole(input.role)) {
      throw new AppError('VALIDATION_ERROR', 'Select a valid account role.');
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

    if (!this.authRepository.adminUpdateUser) {
      throw new AppError('STORAGE_ERROR', 'Admin user editing is unavailable.');
    }

    try {
      return await this.authRepository.adminUpdateUser({
        actorId,
        targetUserId,
        ...(displayName !== undefined ? { displayName } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.classId !== undefined
          ? {
              classId:
                input.classId && input.classId.trim().length > 0
                  ? input.classId.trim()
                  : null,
            }
          : {}),
        ...(studyProgram !== undefined ? { studyProgram } : {}),
        ...(bio !== undefined ? { bio } : {}),
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not update user account.',
      );
    }
  }
}

export class AdminSetUserActive {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: AdminSetUserActiveDto): Promise<User> {
    const actorId = (input.actorId ?? '').trim();
    const targetUserId = (input.targetUserId ?? '').trim();

    if (actorId.length === 0 || targetUserId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Admin actor ID and target user ID are required.',
      );
    }

    if (actorId === targetUserId && !input.active) {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'You cannot deactivate your own admin account.',
      );
    }

    if (!this.authRepository.adminSetUserActive) {
      throw new AppError('STORAGE_ERROR', 'Account activation controls are unavailable.');
    }

    try {
      return await this.authRepository.adminSetUserActive({
        actorId,
        targetUserId,
        active: Boolean(input.active),
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not update account status.',
      );
    }
  }
}

export class AdminResetPassword {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: AdminResetPasswordDto): Promise<void> {
    const actorId = (input.actorId ?? '').trim();
    const targetUserId = (input.targetUserId ?? '').trim();
    const newPassword = input.newPassword ?? '';

    if (actorId.length === 0 || targetUserId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Admin actor ID and target user ID are required.',
      );
    }

    if (!isValidPassword(newPassword)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters.',
      );
    }

    if (
      input.confirmPassword !== undefined &&
      input.confirmPassword !== newPassword
    ) {
      throw new AppError('PASSWORD_MISMATCH', 'Passwords do not match.');
    }

    if (!this.authRepository.adminResetPassword) {
      throw new AppError('STORAGE_ERROR', 'Password reset is unavailable.');
    }

    try {
      await this.authRepository.adminResetPassword({
        actorId,
        targetUserId,
        newPassword,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not reset password.',
      );
    }
  }
}

export class AdminCreateClass {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: AdminCreateClassDto): Promise<Class> {
    const actorId = (input.actorId ?? '').trim();
    const name = (input.name ?? '').trim();
    const rawJoinCode = (input.joinCode ?? '').trim().toUpperCase();

    if (actorId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Admin actor ID is required.');
    }
    if (name.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Class name is required.');
    }
    if (name.length > 80) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Class name must be 80 characters or fewer.',
      );
    }

    const joinCode = rawJoinCode.length > 0 ? rawJoinCode : generateClassCode();
    if (!JOIN_CODE_PATTERN.test(joinCode)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Class join code must be 3 to 16 letters, digits, or internal hyphens.',
      );
    }

    if (!this.authRepository.adminCreateClass) {
      throw new AppError('STORAGE_ERROR', 'Admin class creation is unavailable.');
    }

    try {
      return await this.authRepository.adminCreateClass(actorId, name, joinCode);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'STORAGE_ERROR',
        error instanceof Error ? error.message : 'Could not create class.',
      );
    }
  }
}

export class ChangeOwnPassword {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: ChangeOwnPasswordDto): Promise<void> {
    const userId = (input.userId ?? '').trim();
    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';

    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }
    if (currentPassword.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Enter your current password.');
    }
    if (!isValidPassword(newPassword)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'New password must be at least 8 characters.',
      );
    }
    if (
      input.confirmNewPassword !== undefined &&
      input.confirmNewPassword !== newPassword
    ) {
      throw new AppError('PASSWORD_MISMATCH', 'New passwords do not match.');
    }
    if (newPassword === currentPassword) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Choose a new password different from your current password.',
      );
    }

    if (!this.authRepository.changeOwnPassword) {
      throw new AppError('STORAGE_ERROR', 'Password updates are unavailable.');
    }

    try {
      await this.authRepository.changeOwnPassword({
        userId,
        currentPassword,
        newPassword,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw new AppError(
        'AUTH_ERROR',
        error instanceof Error ? error.message : 'Could not change password.',
      );
    }
  }
}
