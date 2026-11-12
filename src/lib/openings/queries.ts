import { currentCycle, type ExpectedRow } from '@/lib/openings/expected';
import { isStale, sortOpportunities, type Opportunity } from '@/lib/openings/opportunities';
import { supabase } from '@/lib/supabase';
import type { Region } from '@/lib/tracker/openings';
import { OPENING_COLUMNS, type Opening } from '@/lib/tracker/queries';

/**
 * The website's public boards, read straight from its database: `expected_openings`,
 * `opportunities` and `jobs` are all public to read, as they are on simplytk.com.
 */

/** Predictions for the cycle in progress that haven't opened yet, soonest first. */
export async function fetchExpected(programmes: readonly string[] = [], now = new Date()): Promise<ExpectedRow[]> {
  let query = supabase
    .from('expected_openings')
    .select('id, company_name, programme_type, last_opened_at, last_cycle, evidence_source, expected_on, expected_from, expected_to, confidence')
    .eq('cycle', currentCycle(now))
    .is('opened_job_id', null);
  if (programmes.length) query = query.in('programme_type', programmes);
  const { data, error } = await query.order('expected_from', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpectedRow[];
}

/** A market's own opportunities plus the ones online or open to anyone, in the site's order. */
export async function fetchOpportunities(region: Region, now = new Date()): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, name, organiser, kind, description, url, location, event_date, deadline, created_at')
    .eq('is_active', true)
    .in('region', [region, 'global']);
  if (error) throw new Error(error.message);
  return sortOpportunities(((data ?? []) as Opportunity[]).filter((row) => !isStale(row, now)), now);
}

export const LIVE_FEED_LIMIT = 60;

/** The newest detections, as the site's live feed shows them. */
export async function fetchLiveFeed(): Promise<Opening[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(OPENING_COLUMNS)
    .eq('status', 'open')
    .is('variant_of', null)
    .order('first_seen_at', { ascending: false })
    .limit(LIVE_FEED_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Opening[];
}
