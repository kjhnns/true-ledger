/**
 * File validation utilities for secure file upload handling
 */

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePdfFile(file: {
  name?: string;
  size?: number;
  mimeType?: string | null;
  uri?: string;
}): FileValidationResult {
  // Check file name
  if (!file.name) {
    return { valid: false, error: 'File name is required' };
  }

  // Check file extension
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf') {
    return {
      valid: false,
      error: `Invalid file type. Only PDF files are allowed, got: .${extension}`,
    };
  }

  // Check MIME type if available
  if (file.mimeType && !ALLOWED_MIME_TYPES.includes(file.mimeType as any)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${file.mimeType}. Only PDF files are allowed.`,
    };
  }

  // Check file size if available
  if (file.size !== undefined) {
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB, got: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }
  }

  // Check URI is present
  if (!file.uri) {
    return { valid: false, error: 'File URI is required' };
  }

  return { valid: true };
}

export function sanitizeFileName(fileName: string): string {
  // Remove any path traversal attempts
  const baseName = fileName.split('/').pop() || 'unknown.pdf';

  // Remove potentially dangerous characters
  return baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .substring(0, 255); // Limit length
}
