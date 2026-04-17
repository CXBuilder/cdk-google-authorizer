import type {
  CloudFrontRequestEvent,
  CloudFrontRequestResult,
  CloudFrontRequest,
} from 'aws-lambda';

import { loadConfig, AuthorizerConfig } from './config';
import { parseCookies, serializeCookie, EXPIRED_COOKIE_DATE } from './cookies';
import { generateNonce, validateNonce } from './nonce';
import { signSessionJwt, verifySessionJwt } from './session';
import {
  buildGoogleAuthRedirectUrl,
  exchangeCodeForTokens,
  verifyGoogleIdToken,
} from './google';
import {
  redirectResponse,
  unauthorizedResponse,
  internalServerErrorResponse,
} from './responses';

function getHost(request: CloudFrontRequest): string {
  const hostHeader = request.headers['host']?.[0]?.value;
  if (!hostHeader) throw new Error('Missing host header');
  return hostHeader;
}

function getCookieHeader(request: CloudFrontRequest): string | undefined {
  return request.headers['cookie']?.[0]?.value;
}

function getQueryParams(request: CloudFrontRequest): URLSearchParams {
  return new URLSearchParams(request.querystring);
}

function buildRedirectUri(request: CloudFrontRequest, callbackPath: string): string {
  return `https://${getHost(request)}${callbackPath}`;
}

/**
 * Ensures a redirect target is a same-origin path. Rejects protocol-relative
 * (`//evil.com`), backslash-prefixed (`/\evil.com` — some browsers coerce to `//`),
 * and absolute URLs. Falls back to `/`.
 */
function sanitizeSameOriginPath(candidate: string): string {
  if (!candidate || candidate.length === 0) return '/';
  if (!candidate.startsWith('/')) return '/';
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return '/';
  return candidate;
}

export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  try {
    const record = event.Records[0];
    const { request } = record.cf;
    const config = await loadConfig(record.cf.config.distributionId);

    if (request.uri.startsWith(config.callbackPath)) {
      return await handleCallback(request, config);
    }

    if (await hasValidSession(request, config)) {
      return request;
    }

    return startLoginFlow(request, config);
  } catch (err) {
    console.error('Authorizer error', err);
    return internalServerErrorResponse();
  }
};

async function hasValidSession(
  request: CloudFrontRequest,
  config: AuthorizerConfig
): Promise<boolean> {
  const cookies = parseCookies(getCookieHeader(request));
  const token = cookies['TOKEN'];
  if (!token) return false;
  try {
    await verifySessionJwt(token, config.publicKey.trim(), getHost(request));
    return true;
  } catch {
    return false;
  }
}

function startLoginFlow(
  request: CloudFrontRequest,
  config: AuthorizerConfig
): CloudFrontRequestResult {
  const { nonce, hash } = generateNonce();
  const safePath = sanitizeSameOriginPath(request.uri);
  const state = safePath + (request.querystring ? `?${request.querystring}` : '');
  const location = buildGoogleAuthRedirectUrl({
    clientId: config.clientId,
    redirectUri: buildRedirectUri(request, config.callbackPath),
    state,
    nonce,
    hostedDomain: config.hostedDomain,
  });
  return redirectResponse(location, [
    serializeCookie('TOKEN', '', { path: '/', expires: EXPIRED_COOKIE_DATE }),
    serializeCookie('NONCE', hash, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }),
  ]);
}

async function handleCallback(
  request: CloudFrontRequest,
  config: AuthorizerConfig
): Promise<CloudFrontRequestResult> {
  const qs = getQueryParams(request);
  if (qs.get('error')) return unauthorizedResponse();

  const code = qs.get('code');
  const state = sanitizeSameOriginPath(qs.get('state') ?? '/');
  if (!code) return unauthorizedResponse();

  const { idToken } = await exchangeCodeForTokens({
    code,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: buildRedirectUri(request, config.callbackPath),
  });

  const claims = await verifyGoogleIdToken(idToken, config.clientId);

  if (config.hostedDomain && claims.hd !== config.hostedDomain) {
    return unauthorizedResponse();
  }
  if (config.allowedEmails && config.allowedEmails.length > 0) {
    if (!claims.email || !config.allowedEmails.includes(claims.email)) {
      return unauthorizedResponse();
    }
  }
  if (claims.email_verified === false) {
    return unauthorizedResponse();
  }

  const cookies = parseCookies(getCookieHeader(request));
  if (!validateNonce(claims.nonce, cookies['NONCE'])) {
    return unauthorizedResponse();
  }

  const email = claims.email;
  if (!email) return unauthorizedResponse();

  const sessionJwt = await signSessionJwt({
    privateKeyPem: config.privateKey.trim(),
    email,
    audience: getHost(request),
    sessionDurationSeconds: config.sessionDurationSeconds,
  });

  return redirectResponse(state, [
    serializeCookie('TOKEN', sessionJwt, {
      path: '/',
      maxAge: config.sessionDurationSeconds,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }),
    serializeCookie('NONCE', '', { path: '/', expires: EXPIRED_COOKIE_DATE }),
  ]);
}
