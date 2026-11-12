import { useCallback, useRef, useState } from 'react';

/**
 * One AI run at a time: `run(task)` sets `busy`, keeps the failure's message in `error`,
 * and resolves to the result, or null when it failed or another run was in flight.
 */
export function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
