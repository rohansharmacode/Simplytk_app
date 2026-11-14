import { authErrorMessage, cleanCode, toE164Phone } from '../phone';

describe('toE164Phone', () => {
  it('reads a national number in the picked country', () => {
    expect(toE164Phone('GB', '07700 900123')).toBe('+447700900123');
    expect(toE164Phone('US', '(415) 555-0123')).toBe('+14155550123');
    expect(toE164Phone('IT', '06 1234 5678')).toBe('+390612345678');
  });

  it('lets a typed country code override the picker', () => {
    expect(toE164Phone('GB', '+91 98765 43210')).toBe('+919876543210');
    expect(toE164Phone('GB', '0091 98765 43210')).toBe('+919876543210');
  });

  it('refuses numbers that cannot be whole', () => {
    expect(toE164Phone('GB', '0770')).toBeNull();
    expect(toE164Phone('GB', 'call me')).toBeNull();
    expect(toE164Phone('GB', '+0123456789')).toBeNull();
  });
});

describe('cleanCode', () => {
  it('keeps six digits', () => {
    expect(cleanCode(' 123 456 7')).toBe('123456');
    expect(cleanCode('12-34')).toBe('1234');
  });
});

describe('authErrorMessage', () => {
  it('words the errors a student can act on', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(/don’t match/);
    expect(authErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(/expired/);
    expect(authErrorMessage({ code: 'email_provider_disabled', message: 'Email logins are disabled' })).toMatch(/phone number or Apple/);
    expect(authErrorMessage({ message: 'Something new' })).toBe('Something new');
  });
});
