import { parseCookies, serializeCookie, EXPIRED_COOKIE_DATE } from '../../src/lambda/cookies';

describe('parseCookies', () => {
  test('returns empty for undefined', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  test('parses a simple cookie', () => {
    expect(parseCookies('TOKEN=abc')).toEqual({ TOKEN: 'abc' });
  });

  test('parses multiple cookies', () => {
    expect(parseCookies('TOKEN=abc; NONCE=def; X=1')).toEqual({
      TOKEN: 'abc',
      NONCE: 'def',
      X: '1',
    });
  });

  test('url-decodes values', () => {
    expect(parseCookies('K=a%20b')).toEqual({ K: 'a b' });
  });
});

describe('serializeCookie', () => {
  test('basic cookie', () => {
    expect(serializeCookie('X', 'y')).toBe('X=y');
  });

  test('sets flags', () => {
    const out = serializeCookie('TOKEN', 'abc', {
      path: '/',
      maxAge: 60,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
    expect(out).toContain('TOKEN=abc');
    expect(out).toContain('Path=/');
    expect(out).toContain('Max-Age=60');
    expect(out).toContain('HttpOnly');
    expect(out).toContain('Secure');
    expect(out).toContain('SameSite=Lax');
  });

  test('uses expired date to clear', () => {
    const out = serializeCookie('TOKEN', '', { path: '/', expires: EXPIRED_COOKIE_DATE });
    expect(out).toContain('Expires=Thu, 01 Jan 1970');
  });
});
