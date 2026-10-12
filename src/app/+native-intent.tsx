import { hrefForIncomingUrl } from '@/lib/routes';

/**
 * Universal links (https://simplytk.com/...) and simplytk:// links arrive here before
 * routing. Site URLs are mapped onto the tab that owns that section, or a pushed page.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return hrefForIncomingUrl(path);
  } catch {
    return '/';
  }
}
