import type { CloudFrontResultResponse } from 'aws-lambda';
import { serializeCookie, EXPIRED_COOKIE_DATE } from './cookies';

const UNAUTHORIZED_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>401 Unauthorized</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#21232a;color:#fff;text-align:center;padding:4rem}h1{font-weight:500}p{color:silver}</style>
</head><body><h1>Unauthorized</h1><small>Error 401</small><p>You are not permitted to view this content.</p></body></html>`;

const SERVER_ERROR_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>500 Internal Server Error</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#21232a;color:#fff;text-align:center;padding:4rem}h1{font-weight:500}p{color:silver}</style>
</head><body><h1>Internal Server Error</h1><small>Error 500</small></body></html>`;

function clearAuthCookies(): { key: string; value: string }[] {
  return [
    { key: 'Set-Cookie', value: serializeCookie('TOKEN', '', { path: '/', expires: EXPIRED_COOKIE_DATE }) },
    { key: 'Set-Cookie', value: serializeCookie('NONCE', '', { path: '/', expires: EXPIRED_COOKIE_DATE }) },
  ];
}

export function unauthorizedResponse(): CloudFrontResultResponse {
  return {
    status: '401',
    statusDescription: 'Unauthorized',
    body: UNAUTHORIZED_HTML,
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
      'set-cookie': clearAuthCookies(),
    },
  };
}

export function internalServerErrorResponse(): CloudFrontResultResponse {
  return {
    status: '500',
    statusDescription: 'Internal Server Error',
    body: SERVER_ERROR_HTML,
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
    },
  };
}

export function redirectResponse(
  location: string,
  setCookies: string[] = []
): CloudFrontResultResponse {
  return {
    status: '302',
    statusDescription: 'Found',
    headers: {
      location: [{ key: 'Location', value: location }],
      'set-cookie': setCookies.map((value) => ({ key: 'Set-Cookie', value })),
    },
  };
}
