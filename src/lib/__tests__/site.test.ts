import {
  classifyUrl,
  cleanTitle,
  isIgnorableLoadError,
  isSiteUrl,
  sitePathFromUrl,
  siteUrl,
  withAppSource,
} from '../site';

describe('classifyUrl', () => {
  it.each([
    ['https://simplytk.com/internship-tracker', 'webview'],
    ['https://www.simplytk.com/cv-rater', 'webview'],
    ['https://SIMPLYTK.com/', 'webview'],
    ['https://kfrlrioicoltydcmkpoi.supabase.co/auth/v1/verify', 'webview'],
    ['https://js.stripe.com/v3/', 'webview'],
    ['https://checkout.stripe.com/c/pay/cs_test', 'webview'],
    ['https://m.stripe.network/inner.html', 'webview'],
    ['about:blank', 'webview'],
    ['blob:https://simplytk.com/0c6f', 'webview'],
  ])('keeps %s in the app', (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
  });

  it.each([
    ['https://calendly.com/tanuj-kakumani/kickstarter', 'browser'],
    ['https://www.goldmansachs.com/careers/students', 'browser'],
    ['http://example.com', 'browser'],
    // Lookalike hosts must not count as simplytk or Stripe.
    ['https://simplytk.com.evil.example/', 'browser'],
    ['https://notstripe.com/', 'browser'],
    ['https://box.com/', 'browser'],
    ['https://notlinkedin.com/', 'browser'],
  ])('sends %s to the in-app browser', (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
  });

  it.each([
    ['mailto:hello@simplytk.com', 'system'],
    ['tel:+441234567890', 'system'],
    ['https://wa.me/?text=hi', 'system'],
    ['https://chat.whatsapp.com/AbCdEf', 'system'],
    ['https://apps.apple.com/app/id1', 'system'],
    ['whatsapp://send?text=hi', 'system'],
    ['webcal://simplytk.com/calendar.ics', 'system'],
    ['https://www.instagram.com/simplytk', 'system'],
    ['https://www.linkedin.com/in/tanuj', 'system'],
    ['https://www.tiktok.com/@simplytk', 'system'],
    ['https://www.youtube.com/@simplytk', 'system'],
    ['https://x.com/simplytk', 'system'],
  ])('hands %s to the OS', (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'not a url', ''])('blocks %p', (url) => {
    expect(classifyUrl(url)).toBe('block');
  });
});

describe('site URLs', () => {
  it('recognises only simplytk.com over http(s)', () => {
    expect(isSiteUrl('https://simplytk.com/daily')).toBe(true);
    expect(isSiteUrl('https://www.simplytk.com')).toBe(true);
    expect(isSiteUrl('https://simplytk.co/daily')).toBe(false);
    expect(isSiteUrl('simplytk://daily')).toBe(false);
    expect(isSiteUrl('garbage')).toBe(false);
  });

  it('builds absolute URLs from paths', () => {
    expect(siteUrl('/cv-rater')).toBe('https://simplytk.com/cv-rater');
    expect(siteUrl('cv-rater?x=1')).toBe('https://simplytk.com/cv-rater?x=1');
  });

  it('extracts the path, query and hash of simplytk URLs only', () => {
    expect(sitePathFromUrl('https://simplytk.com/companies/optiver?tab=open#roles')).toBe(
      '/companies/optiver?tab=open#roles',
    );
    expect(sitePathFromUrl('https://simplytk.com')).toBe('/');
    expect(sitePathFromUrl('https://calendly.com/x')).toBeNull();
  });

  it('tags entry points with source=app', () => {
    expect(withAppSource('/dashboard')).toBe('/dashboard?source=app');
    expect(withAppSource('/internship-tracker?sector=law')).toBe(
      '/internship-tracker?sector=law&source=app',
    );
  });
});

describe('cleanTitle', () => {
  it.each([
    ['CV Rater · simplytk', 'CV Rater'],
    ['Home · simplytk', 'Home'],
    ['simplytk · Live internship tracker, AI CV rater and mentoring', 'Live internship tracker, AI CV rater and mentoring'],
    ['OA Prep · Every Online Assessment Game Explained · simplytk', 'OA Prep'],
    [
      'Goldman Sachs Spring Week & Internships 2027 – Live Status, Deadlines & Application Links',
      'Goldman Sachs Spring Week & Internships 2027',
    ],
    ['Year-round off-cycle roles', 'Year-round off-cycle roles'],
    ['simplytk', ''],
    ['', ''],
  ])('%p -> %p', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected);
  });
});

describe('isIgnorableLoadError', () => {
  it('ignores cancelled navigations and media hand-offs', () => {
    expect(isIgnorableLoadError({ domain: 'NSURLErrorDomain', code: -999 })).toBe(true);
    expect(isIgnorableLoadError({ domain: 'WebKitErrorDomain', code: 102 })).toBe(true);
    expect(isIgnorableLoadError({ domain: 'WebKitErrorDomain', code: 204 })).toBe(true);
  });

  it('reports real failures', () => {
    expect(isIgnorableLoadError({ domain: 'NSURLErrorDomain', code: -1009 })).toBe(false);
    expect(isIgnorableLoadError({ code: -2 })).toBe(false);
  });
});
