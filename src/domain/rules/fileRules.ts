export const MAX_MATERIAL_FILE_BYTES = 5 * 1024 * 1024;
export const SUB_ONE_MB_BYTES = 1 * 1024 * 1024;

export type FileValidationErrorReason =
  | 'empty_file'
  | 'invalid_mime_type'
  | 'file_too_large';

export type FileValidationResult =
  | { valid: true }
  | { valid: false; reason: FileValidationErrorReason };

export interface MaterialFileCandidate {
  name: string;
  sizeBytes: number;
  mimeType: string;
}

// Require both a non-empty .pdf stem and application/pdf (or blank browser MIME) to block spoofed attachments.
export function validateMaterialFile(
  file: MaterialFileCandidate,
): FileValidationResult {
  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    return { valid: false, reason: 'empty_file' };
  }

  const trimmedName = file.name.trim();
  const hasPdfExtension =
    trimmedName.length > 4 && trimmedName.toLowerCase().endsWith('.pdf');
  const normalizedMime = file.mimeType.trim().toLowerCase();
  const hasAllowedMime =
    normalizedMime === 'application/pdf' || normalizedMime === '';

  if (!hasPdfExtension || !hasAllowedMime) {
    return { valid: false, reason: 'invalid_mime_type' };
  }

  if (file.sizeBytes > MAX_MATERIAL_FILE_BYTES) {
    return { valid: false, reason: 'file_too_large' };
  }

  return { valid: true };
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < SUB_ONE_MB_BYTES) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / SUB_ONE_MB_BYTES).toFixed(2)} MB`;
}
