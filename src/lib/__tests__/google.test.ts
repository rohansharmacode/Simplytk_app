import { googleSignInUrl, readOAuthReturn } from '../google';

describe('Google sign-in', () => {
  it('asks the website broker to come back to simplytk.com/auth', () => {
    const url = new URL(googleSignInUrl('s1'));
    expect(url.origin + url.pathname).toBe('https://simplytk.com/~oauth/initiate');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_uri')).toBe('https://simplytk.com/auth');
    expect(url.searchParams.get('state')).toBe('s1');
  });

  it('reads tokens from the fragment or the query', () => {
    expect(readOAuthReturn('https://simplytk.com/auth#access_token=a&refresh_token=r&state=s1', 's1')).toEqual({
      tokens: { access_token: 'a', refresh_token: 'r' },
    });
    expect(readOAuthReturn('https://simplytk.com/auth?state=s1&access_token=a&refresh_token=r', 's1')).toEqual({
      tokens: { access_token: 'a', refresh_token: 'r' },
    });
  });

  it('refuses a return for another request', () => {
    expect(readOAuthReturn('https://simplytk.com/auth#access_token=a&refresh_token=r&state=other', 's1')).toHaveProperty('error');
  });

  it('passes on the broker’s error', () => {
    expect(readOAuthReturn('https://simplytk.com/auth?error=access_denied&error_description=Cancelled&state=s1', 's1')).toEqual({
      error: 'Cancelled',
    });
    expect(readOAuthReturn('https://simplytk.com/auth?state=s1', 's1')).toHaveProperty('error');
  });
});
