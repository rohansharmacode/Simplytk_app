import { SITE_ORIGIN } from '@/lib/site';

/**
 * Google sign-in, through the same Lovable Cloud sign-in broker the website uses
 * (`/~oauth/initiate`), since the project's Google provider lives there and not in its auth
 * service. The broker only returns to the site's own addresses, so the app opens it in an
 * iOS auth session that catches the return to https://simplytk.com/auth (an HTTPS callback,
 * iOS 17.4 and later, through the app's associated domains) and reads the tokens from it.
 */
export const GOOGLE_RETURN_URL = `${SITE_ORIGIN}/auth`;

/** The broker's address for one sign-in, with `state` to match on the way back. */
export function googleSignInUrl(state: string): string {
  const params = new URLSearchParams({
    provider: 'google',
    redirect_uri: GOOGLE_RETURN_URL,
    state,
    // Always show the account chooser, as the website does: phones get shared too.
    prompt: 'select_account',
  });
  return `${SITE_ORIGIN}/~oauth/initiate?${params.toString()}`;
}

export type OAuthReturn =
  | { tokens: { access_token: string; refresh_token: string } }
  | { error: string };

/**
 * Reads the broker's return address. The answer can be in the query or the fragment, so
 * both are read. A state that doesn't match is refused, so a stray link can't sign anyone in.
 */
export function readOAuthReturn(url: string, expectedState: string): OAuthReturn {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'Google sign-in came back in a form the app doesn’t understand.' };
  }
  const values = new URLSearchParams(parsed.search);
  new URLSearchParams(parsed.hash.replace(/^#/, '')).forEach((value, key) => values.set(key, value));
  const error = values.get('error');
  if (error) return { error: values.get('error_description') || 'Google sign-in didn’t finish. Try again.' };
  if (values.get('state') !== expectedState) return { error: 'Google sign-in didn’t match this request. Try again.' };
  const access = values.get('access_token');
  const refresh = values.get('refresh_token');
  if (!access || !refresh) return { error: 'Google sign-in came back without a session. Try again.' };
  return { tokens: { access_token: access, refresh_token: refresh } };
}
