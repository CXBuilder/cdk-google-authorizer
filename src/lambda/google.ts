import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUER = 'https://accounts.google.com';

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface GoogleIdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  hd?: string;
  nonce?: string;
  name?: string;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { id_token?: string };
  if (!json.id_token) throw new Error('Token response missing id_token');
  return { idToken: json.id_token };
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleIdTokenClaims> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: [GOOGLE_ISSUER, 'accounts.google.com'],
    audience: clientId,
  });
  return payload as GoogleIdTokenClaims;
}

export function buildGoogleAuthRedirectUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  hostedDomain?: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    prompt: 'select_account',
    access_type: 'online',
  });
  if (params.hostedDomain) qs.set('hd', params.hostedDomain);
  return `${GOOGLE_AUTH_ENDPOINT}?${qs.toString()}`;
}
