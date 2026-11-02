import { router } from 'expo-router';

/** Open a simplytk.com page in a web view over the tabs. */
export function openWebPage(path: string, title: string) {
  router.push({ pathname: '/page', params: { path, title } });
}
