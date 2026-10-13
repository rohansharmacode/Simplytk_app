import Storage from 'expo-sqlite/kv-store';

/**
 * Personal bests for the native drills, kept on the device. These are practice runs: they
 * don't reach the site's leaderboards until the app can sign in and submit ranked runs.
 */
const key = (drill: string, variant: string) => `best:${drill}:${variant}`;

export function getBestScore(drill: string, variant: string): number | null {
  try {
    const stored = Storage.getItemSync(key(drill, variant));
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves `score` if it beats the stored best. Returns whether it did. */
export function recordScore(drill: string, variant: string, score: number): boolean {
  const best = getBestScore(drill, variant);
  if (score <= 0 || (best !== null && score <= best)) return false;
  try {
    Storage.setItemSync(key(drill, variant), String(score));
  } catch {
    // A best that can't be saved still counts for this run.
  }
  return true;
}
