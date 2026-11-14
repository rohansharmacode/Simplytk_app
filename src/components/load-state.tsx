import { Button, Empty, Loading } from '@/components/ui';
import { openWebPage } from '@/lib/web-pages';

/**
 * What a screen shows before its data is there: a spinner, the error with a retry, or,
 * while the website doesn't serve the app's endpoint yet, its web page instead.
 * Returns null once there's data to show.
 */
export function LoadState({
  loaded,
  error,
  missing,
  retry,
  web,
}: {
  loaded: boolean;
  error: string | null;
  missing: boolean;
  retry: () => void;
  /** The website's page for the same thing. */
  web: { path: string; title: string };
}) {
  if (loaded) return null;
  if (missing) {
    return (
      <Empty
        title="Coming to the app soon"
        body="This part of the app is waiting on a website update. Until then, it’s on simplytk.com."
        action={<Button label="Open on simplytk.com" onPress={() => openWebPage(web.path, web.title)} />}
      />
    );
  }
  if (error) {
    return <Empty title="Couldn’t load this" body={error} action={<Button variant="secondary" label="Try again" onPress={retry} />} />;
  }
  return <Loading />;
}
