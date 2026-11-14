/**
 * Phone sign-in, as the website does it (src/lib/auth-flow.ts there): a texted code that
 * signs an existing phone account in, or makes one. The auth API wants E.164 numbers.
 */

/** The countries offered before the number, the site's students first. */
export const PHONE_COUNTRIES = [
  { iso: 'GB', name: 'UK', dial: '44' },
  { iso: 'IE', name: 'Ireland', dial: '353' },
  { iso: 'US', name: 'US', dial: '1' },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'HK', name: 'Hong Kong', dial: '852' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'AE', name: 'UAE', dial: '971' },
  { iso: 'NG', name: 'Nigeria', dial: '234' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'FR', name: 'France', dial: '33' },
  { iso: 'DE', name: 'Germany', dial: '49' },
  { iso: 'ES', name: 'Spain', dial: '34' },
  { iso: 'IT', name: 'Italy', dial: '39' },
  { iso: 'NL', name: 'Netherlands', dial: '31' },
  { iso: 'AU', name: 'Australia', dial: '61' },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]['iso'];

/**
 * A typed number as E.164 (+447700900123), or null when it can't be a full number. A
 * number starting with + or 00 carries its own country code; anything else is national in
 * the picked country, with the trunk 0 dropped (Italy keeps its leading 0).
 */
export function toE164Phone(country: PhoneCountry, raw: string): string | null {
  const compact = raw.trim().replace(/[\s().-]/g, '');
  let digits: string;
  if (compact.startsWith('+')) {
    digits = compact.slice(1);
  } else if (compact.startsWith('00')) {
    digits = compact.slice(2);
  } else {
    const dial = PHONE_COUNTRIES.find((c) => c.iso === country)?.dial;
    if (!dial) return null;
    digits = dial + (dial === '39' ? compact : compact.replace(/^0/, ''));
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Just the digits of a typed code, at most six (the auth service sends six). */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

type AuthErrorLike = { code?: string | null; message: string };

/** An auth error a student can act on, matching the website's wording. */
export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return 'That email and password don’t match a simplytk account.';
  }
  if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
    return 'That email isn’t confirmed yet. Confirm it from the email simplytk sent, then sign in.';
  }
  if (error.code === 'email_provider_disabled') {
    return 'Email sign-in isn’t available right now. Use your phone number or Apple instead.';
  }
  if (error.code === 'otp_expired' || /token has expired or is invalid/i.test(error.message)) {
    return 'That code is wrong or has expired. Check it, or send a new one.';
  }
  if (error.code === 'over_sms_send_rate_limit') {
    return 'We’ve sent a few texts to that number already. Wait a minute, then try again.';
  }
  if (error.code === 'sms_send_failed') {
    return 'We couldn’t text that number. Check the country and the number, then try again.';
  }
  if (error.code === 'phone_provider_disabled') {
    return 'Phone sign-in isn’t available right now. Use Apple or your email instead.';
  }
  return error.message;
}
