import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load something for a screen, with pull to refresh. `data` is undefined until the first
 * load ends; a failed refresh keeps what was already showing and sets `error`. It loads
 * again whenever `key` changes, e.g. when a filter that the load depends on changes.
 */
export function useLoad<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const latest = useRef(load);

  useEffect(() => {
    latest.current = load;
  });

  // Only the newest request may write, so a slow answer can't replace a newer one.
  const reload = useCallback(() => {
    const id = ++request.current;
    return latest.current().then(
      (next) => {
        if (id !== request.current) return;
        setData(next);
        setError(null);
      },
      (failure: unknown) => {
        if (id !== request.current) return;
        setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, error, refreshing, refresh, reload, setData };
}
