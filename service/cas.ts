import crypto from 'node:crypto';

export interface CasValidationResult {
  match: boolean;
  currentSha: string;
}

/**
 * Computes the SHA-256 hex digest of an issue body.
 * If body is null or undefined, empty string is hashed.
 * Normalizes CRLF newlines (\r\n) to LF (\n) to prevent false CAS conflicts.
 */
export function computeIssueSha(body?: string | null): string {
  const content = (body ?? '').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compares current issue body with expected SHA-256 hash.
 * Returns match status and the newly computed currentSha.
 */
export function verifyIssueCas(currentBody: string | null | undefined, expectedSha: string): CasValidationResult {
  const currentSha = computeIssueSha(currentBody);
  const normalizedExpected = (expectedSha || '').trim().toLowerCase();
  const match = currentSha.toLowerCase() === normalizedExpected;
  return {
    match,
    currentSha,
  };
}

/**
 * Compare-And-Swap manager utility for issue mutations.
 */
export class CasManager {
  static compute(body?: string | null): string {
    return computeIssueSha(body);
  }

  static verify(currentBody: string | null | undefined, expectedSha: string): CasValidationResult {
    return verifyIssueCas(currentBody, expectedSha);
  }
}
