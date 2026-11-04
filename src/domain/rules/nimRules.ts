const NIM_REGEX = /^[0-9]{2}[A-Z][0-9]{5}$/;
const MIN_PASSWORD_LENGTH = 8;

export function normalizeNim(rawNim: string): string {
  return rawNim.trim().toUpperCase();
}

export function isValidNim(rawNim: string): boolean {
  if (typeof rawNim !== 'string') {
    return false;
  }
  const normalized = normalizeNim(rawNim);
  return NIM_REGEX.test(normalized);
}

export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  }
  return password.length >= MIN_PASSWORD_LENGTH;
}

