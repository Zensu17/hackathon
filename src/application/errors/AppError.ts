export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_NIM_FORMAT'
  | 'DUPLICATE_NIM'
  | 'PASSWORD_MISMATCH'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN_ROLE'
  | 'DUPLICATE_JOIN_CODE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'STORAGE_ERROR';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
