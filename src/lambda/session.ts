import { importPKCS8, importSPKI, SignJWT, jwtVerify, JWTPayload } from 'jose';

const ALG = 'RS256';

export interface SessionClaims extends JWTPayload {
  email: string;
}

export async function signSessionJwt(params: {
  privateKeyPem: string;
  email: string;
  audience: string;
  sessionDurationSeconds: number;
}): Promise<string> {
  const key = await importPKCS8(params.privateKeyPem, ALG);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: params.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(params.email)
    .setAudience(params.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + params.sessionDurationSeconds)
    .sign(key);
}

export async function verifySessionJwt(
  token: string,
  publicKeyPem: string,
  audience: string
): Promise<SessionClaims> {
  const key = await importSPKI(publicKeyPem, ALG);
  const { payload } = await jwtVerify(token, key, {
    algorithms: [ALG],
    audience,
  });
  return payload as SessionClaims;
}
