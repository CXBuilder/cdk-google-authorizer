import { buildGoogleAuthRedirectUrl, GOOGLE_AUTH_ENDPOINT } from '../../src/lambda/google';

describe('buildGoogleAuthRedirectUrl', () => {
  test('produces a URL with required params', () => {
    const url = new URL(
      buildGoogleAuthRedirectUrl({
        clientId: 'xyz.apps.googleusercontent.com',
        redirectUri: 'https://example.cloudfront.net/_callback',
        state: '/dashboard',
        nonce: 'abcd1234',
      })
    );
    expect(url.origin + url.pathname).toBe(GOOGLE_AUTH_ENDPOINT);
    expect(url.searchParams.get('client_id')).toBe('xyz.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.cloudfront.net/_callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('/dashboard');
    expect(url.searchParams.get('nonce')).toBe('abcd1234');
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.has('hd')).toBe(false);
  });

  test('adds hd when hostedDomain is set', () => {
    const url = new URL(
      buildGoogleAuthRedirectUrl({
        clientId: 'x',
        redirectUri: 'https://x',
        state: '/',
        nonce: 'n',
        hostedDomain: 'cxbuilder.ai',
      })
    );
    expect(url.searchParams.get('hd')).toBe('cxbuilder.ai');
  });
});
