import { generateSigningKeyPair } from '../../src/generateSigningKeyPair';
import { signSessionJwt, verifySessionJwt } from '../../src/lambda/session';

describe('session JWT', () => {
  const { privateKey, publicKey } = generateSigningKeyPair();

  test('signs and verifies a session token', async () => {
    const token = await signSessionJwt({
      privateKeyPem: privateKey,
      email: 'sam@sfr.io',
      audience: 'example.cloudfront.net',
      sessionDurationSeconds: 3600,
    });
    const claims = await verifySessionJwt(token, publicKey, 'example.cloudfront.net');
    expect(claims.email).toBe('sam@sfr.io');
    expect(claims.sub).toBe('sam@sfr.io');
    expect(claims.aud).toBe('example.cloudfront.net');
    expect(claims.exp).toBeGreaterThan(claims.iat!);
  });

  test('rejects wrong audience', async () => {
    const token = await signSessionJwt({
      privateKeyPem: privateKey,
      email: 'sam@sfr.io',
      audience: 'example.cloudfront.net',
      sessionDurationSeconds: 3600,
    });
    await expect(
      verifySessionJwt(token, publicKey, 'attacker.example.com')
    ).rejects.toThrow();
  });

  test('rejects expired token', async () => {
    const token = await signSessionJwt({
      privateKeyPem: privateKey,
      email: 'sam@sfr.io',
      audience: 'example.cloudfront.net',
      sessionDurationSeconds: -10,
    });
    await expect(
      verifySessionJwt(token, publicKey, 'example.cloudfront.net')
    ).rejects.toThrow();
  });

  test('rejects token signed with different key', async () => {
    const other = generateSigningKeyPair();
    const token = await signSessionJwt({
      privateKeyPem: other.privateKey,
      email: 'sam@sfr.io',
      audience: 'example.cloudfront.net',
      sessionDurationSeconds: 3600,
    });
    await expect(
      verifySessionJwt(token, publicKey, 'example.cloudfront.net')
    ).rejects.toThrow();
  });
});
