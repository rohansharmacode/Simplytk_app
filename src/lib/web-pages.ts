import { router, type Href } from 'expo-router';

import { hrefForSitePath } from '@/lib/routes';

const TABS = ['/', '/tracker', '/daily', '/ranks', '/more'];

/** Open a simplytk.com page in a web view over the tabs. */
export function openWebPage(path: string, title: string) {
  router.push({ pathname: '/page', params: { path, title } });
}

/**
 * Open a simplytk.com path the best way the app can: its native screen or drill if there
 * is one, else the page in a web view.
 */
export function openSitePath(path: string, title: string) {
  const href = hrefForSitePath(path);
  if (href.startsWith('/page?')) openWebPage(path, title);
  // A tab is switched to, not stacked on top of itself.
  else if (TABS.includes(href.split(/[?#]/, 1)[0])) router.navigate(href as Href);
  else router.push(href as Href);
}
