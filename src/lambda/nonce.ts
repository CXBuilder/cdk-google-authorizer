import { createHmac, randomBytes } from 'crypto';

export function generateNonce(): { nonce: string; hash: string } {
  const nonce = randomBytes(32).toString('hex');
  const hash = createHmac('sha256', nonce).digest('hex');
  return { nonce, hash };
}

export function validateNonce(nonce: string | undefined, hash: string | undefined): boolean {
  if (!nonce || !hash) return false;
  const expected = createHmac('sha256', nonce).digest('hex');
  return expected === hash;
}
