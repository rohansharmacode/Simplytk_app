import {
  hrefForIncomingUrl,
  hrefForNotificationData,
  hrefForSitePath,
  tabForSitePath,
} from '../routes';

const page = (path: string) => `/page?path=${encodeURIComponent(path)}`;

describe('tabForSitePath', () => {
  it.each([
    ['/dashboard', 'index'],
    ['/dashboard/applications', 'index'],
    ['/internship-tracker/spring-weeks', 'tracker'],
    ['/internship-tracker?sector=law', 'tracker'],
    ['/companies/jane-street', 'tracker'],
    ['/live', 'tracker'],
    ['/expected-openings', 'tracker'],
    ['/progress', 'progress'],
  ])('%s belongs to %s', (path, tab) => {
    expect(tabForSitePath(path)).toBe(tab);
  });

  it.each(['/cv-rater', '/daily', '/explore', '/livestream', '/dashboards', '/'])('%s has no tab', (path) => {
    expect(tabForSitePath(path)).toBeNull();
  });
});

describe('hrefForSitePath', () => {
  it('opens tab sections in their tab', () => {
    expect(hrefForSitePath('/companies/optiver')).toBe('/tracker?path=%2Fcompanies%2Foptiver');
    expect(hrefForSitePath('/dashboard/applications')).toBe(
      '/?path=%2Fdashboard%2Fapplications',
    );
  });

  it('opens everything else as a page', () => {
    expect(hrefForSitePath('/cv-rater')).toBe(page('/cv-rater'));
    expect(hrefForSitePath('spring-week-playbook')).toBe(page('/spring-week-playbook'));
    expect(hrefForSitePath('/explore')).toBe(page('/explore'));
  });

  it('opens drills the app has natively in the app', () => {
    expect(hrefForSitePath('/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForSitePath('/fast-fractions?ref=email')).toBe('/play/fast-fractions');
    // Not ported yet: the site's page.
    expect(hrefForSitePath('/sequences')).toBe(page('/sequences'));
  });

  it('sends the bare domain to the home tab', () => {
    expect(hrefForSitePath('/')).toBe('/');
  });
});

describe('hrefForIncomingUrl', () => {
  it('maps universal links to native drills', () => {
    expect(hrefForIncomingUrl('https://simplytk.com/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForIncomingUrl('simplytk://fast-fractions')).toBe('/play/fast-fractions');
  });

  it('maps universal links', () => {
    expect(hrefForIncomingUrl('https://simplytk.com/internship-tracker/spring-weeks')).toBe(
      '/tracker?path=%2Finternship-tracker%2Fspring-weeks',
    );
    expect(hrefForIncomingUrl('https://simplytk.com/cv-rater?utm_source=email#top')).toBe(
      page('/cv-rater?utm_source=email#top'),
    );
    expect(hrefForIncomingUrl('https://simplytk.com/')).toBe('/');
    expect(hrefForIncomingUrl('https://simplytk.com')).toBe('/');
  });

  it('maps custom-scheme links', () => {
    expect(hrefForIncomingUrl('simplytk://cv-rater')).toBe(page('/cv-rater'));
    expect(hrefForIncomingUrl('simplytk:///companies/optiver')).toBe(
      '/tracker?path=%2Fcompanies%2Foptiver',
    );
    expect(hrefForIncomingUrl('simplytk://more')).toBe('/more');
    expect(hrefForIncomingUrl('simplytk://')).toBe('/');
  });

  it('passes app routes through untouched', () => {
    expect(hrefForIncomingUrl('/more')).toBe('/more');
    expect(hrefForIncomingUrl('/drills')).toBe('/drills');
    expect(hrefForIncomingUrl('/play/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForIncomingUrl('/progress')).toBe('/progress');
    expect(hrefForIncomingUrl('/tracker?path=%2Flive')).toBe('/tracker?path=%2Flive');
    expect(hrefForIncomingUrl(page('/pricing'))).toBe(page('/pricing'));
  });

  it('maps bare site paths', () => {
    expect(hrefForIncomingUrl('/companies/optiver')).toBe('/tracker?path=%2Fcompanies%2Foptiver');
    expect(hrefForIncomingUrl('/pricing')).toBe(page('/pricing'));
  });

  it('falls back to home for anything else', () => {
    expect(hrefForIncomingUrl('https://calendly.com/tanuj-kakumani')).toBe('/');
    expect(hrefForIncomingUrl('')).toBe('/');
    expect(hrefForIncomingUrl('nonsense')).toBe('/');
  });
});

describe('hrefForNotificationData', () => {
  it('reads url, then path', () => {
    expect(hrefForNotificationData({ url: 'https://simplytk.com/companies/citadel' })).toBe(
      '/tracker?path=%2Fcompanies%2Fcitadel',
    );
    expect(hrefForNotificationData({ path: '/daily' })).toBe(page('/daily'));
  });

  it('ignores payloads without a link', () => {
    expect(hrefForNotificationData({})).toBeNull();
    expect(hrefForNotificationData({ url: 42 })).toBeNull();
    expect(hrefForNotificationData(null)).toBeNull();
    expect(hrefForNotificationData('https://simplytk.com')).toBeNull();
  });
});
