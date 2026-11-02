import { hrefForIncomingUrl, hrefForNotificationData, hrefForSitePath } from '../routes';

const page = (path: string) => `/page?path=${encodeURIComponent(path)}`;
const ID = '0f8a7c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b';

describe('hrefForSitePath', () => {
  it('opens sections the app has natively on their native screen', () => {
    expect(hrefForSitePath('/dashboard')).toBe('/');
    expect(hrefForSitePath('/internship-tracker')).toBe('/tracker');
    expect(hrefForSitePath('/internship-tracker/spring-weeks')).toBe('/tracker');
    expect(hrefForSitePath('/internship-tracker?sector=law')).toBe('/tracker');
    expect(hrefForSitePath('/daily')).toBe('/daily');
    expect(hrefForSitePath('/oa-leaderboard')).toBe('/ranks');
    expect(hrefForSitePath('/league')).toBe('/ranks?board=league');
  });

  it('opens an opening natively from its page link', () => {
    expect(hrefForSitePath(`/openings/goldman-sachs-spring-week-${ID}`)).toBe(`/opening/${ID}`);
    // A malformed slug is still the website's page.
    expect(hrefForSitePath('/openings/goldman-sachs')).toBe(page('/openings/goldman-sachs'));
  });

  it('keeps dashboard pages the app has no screen for on the web', () => {
    expect(hrefForSitePath('/dashboard/applications')).toBe(page('/dashboard/applications'));
    expect(hrefForSitePath('/dashboard/settings')).toBe(page('/dashboard/settings'));
  });

  it('opens everything else as a page', () => {
    expect(hrefForSitePath('/cv-rater')).toBe(page('/cv-rater'));
    expect(hrefForSitePath('spring-week-playbook')).toBe(page('/spring-week-playbook'));
    expect(hrefForSitePath('/companies/optiver')).toBe(page('/companies/optiver'));
    expect(hrefForSitePath('/dailyish')).toBe(page('/dailyish'));
  });

  it('opens drills the app has natively in the app', () => {
    expect(hrefForSitePath('/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForSitePath('/fast-fractions?ref=email')).toBe('/play/fast-fractions');
    // Not ported yet: the site's page.
    expect(hrefForSitePath('/sequences')).toBe(page('/sequences'));
  });

  it('sends the bare domain to Home', () => {
    expect(hrefForSitePath('/')).toBe('/');
  });
});

describe('hrefForIncomingUrl', () => {
  it('maps universal links', () => {
    expect(hrefForIncomingUrl('https://simplytk.com/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForIncomingUrl('https://simplytk.com/internship-tracker/spring-weeks')).toBe('/tracker');
    expect(hrefForIncomingUrl(`https://simplytk.com/openings/jane-street-trader-${ID}`)).toBe(`/opening/${ID}`);
    expect(hrefForIncomingUrl('https://simplytk.com/cv-rater?utm_source=email#top')).toBe(
      page('/cv-rater?utm_source=email#top'),
    );
    expect(hrefForIncomingUrl('https://simplytk.com/')).toBe('/');
    expect(hrefForIncomingUrl('https://simplytk.com')).toBe('/');
  });

  it('maps custom-scheme links', () => {
    expect(hrefForIncomingUrl('simplytk://cv-rater')).toBe(page('/cv-rater'));
    expect(hrefForIncomingUrl('simplytk://fast-fractions')).toBe('/play/fast-fractions');
    expect(hrefForIncomingUrl('simplytk://more')).toBe('/more');
    expect(hrefForIncomingUrl('simplytk://daily')).toBe('/daily');
    expect(hrefForIncomingUrl('simplytk://')).toBe('/');
  });

  it('passes app routes through untouched', () => {
    expect(hrefForIncomingUrl('/more')).toBe('/more');
    expect(hrefForIncomingUrl('/drills')).toBe('/drills');
    expect(hrefForIncomingUrl('/ranks')).toBe('/ranks');
    expect(hrefForIncomingUrl('/play/mental-maths')).toBe('/play/mental-maths');
    expect(hrefForIncomingUrl(`/opening/${ID}`)).toBe(`/opening/${ID}`);
    expect(hrefForIncomingUrl(page('/pricing'))).toBe(page('/pricing'));
  });

  it('maps bare site paths', () => {
    expect(hrefForIncomingUrl('/companies/optiver')).toBe(page('/companies/optiver'));
    expect(hrefForIncomingUrl('/progress')).toBe(page('/progress'));
  });

  it('falls back to Home for anything else', () => {
    expect(hrefForIncomingUrl('https://calendly.com/tanuj-kakumani')).toBe('/');
    expect(hrefForIncomingUrl('')).toBe('/');
    expect(hrefForIncomingUrl('nonsense')).toBe('/');
  });
});

describe('hrefForNotificationData', () => {
  it('opens the opening an alert is about', () => {
    expect(hrefForNotificationData({ jobId: ID, url: 'https://boards.greenhouse.io/x' })).toBe(`/opening/${ID}`);
    expect(hrefForNotificationData({ jobId: ID.toUpperCase() })).toBe(`/opening/${ID}`);
  });

  it('reads url, then path', () => {
    expect(hrefForNotificationData({ url: 'https://simplytk.com/internship-tracker' })).toBe('/tracker');
    expect(hrefForNotificationData({ path: '/daily' })).toBe('/daily');
  });

  it('opens the tracker for an alert that only links to a firm’s own site', () => {
    expect(hrefForNotificationData({ url: 'https://careers.example.com/job/1' })).toBe('/tracker');
  });

  it('ignores payloads without a link', () => {
    expect(hrefForNotificationData({})).toBeNull();
    expect(hrefForNotificationData({ url: 42 })).toBeNull();
    expect(hrefForNotificationData({ jobId: 'not-an-id' })).toBeNull();
    expect(hrefForNotificationData(null)).toBeNull();
    expect(hrefForNotificationData('https://simplytk.com')).toBeNull();
  });
});
