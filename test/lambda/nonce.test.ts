import { generateNonce, validateNonce } from '../../src/lambda/nonce';

describe('nonce', () => {
  test('generates nonce + hash pair that validates', () => {
    const { nonce, hash } = generateNonce();
    expect(nonce).toHaveLength(64);
    expect(hash).toHaveLength(64);
    expect(validateNonce(nonce, hash)).toBe(true);
  });

  test('rejects tampered nonce', () => {
    const { nonce, hash } = generateNonce();
    expect(validateNonce(nonce + 'x', hash)).toBe(false);
    expect(validateNonce(nonce, hash.replace(/^./, 'x'))).toBe(false);
  });

  test('rejects undefined inputs', () => {
    expect(validateNonce(undefined, 'something')).toBe(false);
    expect(validateNonce('something', undefined)).toBe(false);
  });

  test('produces unique nonces', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a.nonce).not.toEqual(b.nonce);
  });
});
