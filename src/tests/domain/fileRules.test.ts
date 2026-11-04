import { describe, expect, it } from 'vitest';
import {
  MAX_MATERIAL_FILE_BYTES,
  SUB_ONE_MB_BYTES,
  formatByteSize,
  validateMaterialFile,
} from '../../domain/rules/fileRules';

describe('fileRules', () => {
  it('exposes exact 5 MB and 1 MB byte constants', () => {
    expect(MAX_MATERIAL_FILE_BYTES).toBe(5_242_880);
    expect(SUB_ONE_MB_BYTES).toBe(1_048_576);
  });

  describe('validateMaterialFile', () => {
    it('rejects 0-byte, negative, and non-finite file sizes', () => {
      expect(
        validateMaterialFile({
          name: 'week1.pdf',
          sizeBytes: 0,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'empty_file' });

      expect(
        validateMaterialFile({
          name: 'week1.pdf',
          sizeBytes: -10,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'empty_file' });

      expect(
        validateMaterialFile({
          name: 'week1.pdf',
          sizeBytes: Number.NaN,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'empty_file' });
    });

    it('rejects non-PDF extensions and spoofed MIME or filename combinations (T-01-02)', () => {
      expect(
        validateMaterialFile({
          name: 'handout.docx',
          sizeBytes: 120_000,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });

      expect(
        validateMaterialFile({
          name: 'diagram.png',
          sizeBytes: 50_000,
          mimeType: 'image/png',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });

      expect(
        validateMaterialFile({
          name: 'lecture.mp4',
          sizeBytes: 1_000_000,
          mimeType: 'video/mp4',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });

      expect(
        validateMaterialFile({
          name: 'spoofed.pdf',
          sizeBytes: 80_000,
          mimeType: 'image/jpeg',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });

      expect(
        validateMaterialFile({
          name: 'spoofed.docx',
          sizeBytes: 80_000,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });

      expect(
        validateMaterialFile({
          name: '.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'invalid_mime_type' });
    });

    it('accepts valid PDFs up to 5,242,880 bytes including empty browser mimeType on .pdf', () => {
      expect(
        validateMaterialFile({
          name: 'IF1101-Week01.PDF',
          sizeBytes: 420_864,
          mimeType: 'APPLICATION/PDF',
        }),
      ).toEqual({ valid: true });

      expect(
        validateMaterialFile({
          name: 'offline-handout.pdf',
          sizeBytes: 5_242_880,
          mimeType: '',
        }),
      ).toEqual({ valid: true });
    });

    it('rejects PDFs exceeding 5,242,880 bytes', () => {
      expect(
        validateMaterialFile({
          name: 'oversized.pdf',
          sizeBytes: 5_242_881,
          mimeType: 'application/pdf',
        }),
      ).toEqual({ valid: false, reason: 'file_too_large' });
    });
  });

  describe('formatByteSize', () => {
    it('formats exact byte counts deterministically across B, KB, and MB', () => {
      expect(formatByteSize(0)).toBe('0 B');
      expect(formatByteSize(-50)).toBe('0 B');
      expect(formatByteSize(850)).toBe('850 B');
      expect(formatByteSize(1024)).toBe('1.0 KB');
      expect(formatByteSize(420_864)).toBe('411.0 KB');
      expect(formatByteSize(1_048_576)).toBe('1.00 MB');
      expect(formatByteSize(5_054_136)).toBe('4.82 MB');
      expect(formatByteSize(5_242_880)).toBe('5.00 MB');
    });
  });
});
