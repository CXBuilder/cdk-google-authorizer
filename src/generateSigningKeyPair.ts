import { generateKeyPairSync } from 'crypto';

export interface SigningKeyPair {
  readonly privateKey: string;
  readonly publicKey: string;
}

export function generateSigningKeyPair(): SigningKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}
