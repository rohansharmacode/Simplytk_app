import { supabase } from '@/lib/supabase';
import { deadlineCutoff, firmSearchTerm, PRE_UNI_TYPES, type Filters } from '@/lib/tracker/openings';

/**
 * Openings come straight from the website's database: `jobs` and `companies` are public
 * to read, and `saved_jobs` (the website's stars) is each student's own under row-level
 * security. So a star in the app is a star on simplytk.com and the other way round.
 */
export type Opening = {
  id: string;
  title: string;
  programme_type: string | null;
  location: string | null;
  deadline: string | null;
  apply_url: string;
  status: string | null;
  first_seen_at: string | null;
  cover_letter_required: boolean | null;
  visa_sponsorship: boolean | null;
  companies: { name: string; slug: string; logo_url: string | null } | null;
};

export const OPENING_COLUMNS =
  'id, title, programme_type, location, deadline, apply_url, status, first_seen_at, cover_letter_required, visa_sponsorship, companies!inner(name, slug, logo_url)';

export const PAGE_SIZE = 30;

export async function fetchOpenings(filters: Filters, page: number, now = new Date()): Promise<Opening[]> {
  let query = supabase
    .from('jobs')
    .select(OPENING_COLUMNS)
    .eq('status', 'open')
    .eq('region', filters.region)
    // One row per programme: per-office copies point at the first with variant_of.
    .is('variant_of', null);

  if (filters.types.length) {
    query = query.in('programme_type', filters.types);
  } else if (filters.stage === 'preuni') {
    query = query.in('programme_type', [...PRE_UNI_TYPES]);
  } else {
    query = query.not('programme_type', 'in', `(${PRE_UNI_TYPES.join(',')})`);
  }
  const firm = firmSearchTerm(filters.firm);
  if (firm) query = query.ilike('companies.name', `%${firm}%`);
  const cutoff = deadlineCutoff(filters.deadline, now);
  if (cutoff) {
    query = query
      .not('deadline', 'is', null)
      .gte('deadline', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte('deadline', cutoff.toISOString());
  }

  const from = page * PAGE_SIZE;
  const { data, error } = await query
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('first_seen_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Opening[];
}

export async function fetchOpening(id: string): Promise<Opening | null> {
  const { data, error } = await supabase.from('jobs').select(OPENING_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Opening | null) ?? null;
}

/** The signed-in student's starred openings, newest star first. */
export async function fetchStarred(): Promise<Opening[]> {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(`created_at, jobs(${OPENING_COLUMNS})`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { jobs: Opening | null }[])
    .map((row) => row.jobs)
    .filter((job): job is Opening => job !== null);
}

export async function star(jobId: string): Promise<void> {
  const { error } = await supabase.from('saved_jobs').insert({ job_id: jobId });
  // Already starred (on the web, or by a double tap) is fine.
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unstar(jobId: string): Promise<void> {
  const { error } = await supabase.from('saved_jobs').delete().eq('job_id', jobId);
  if (error) throw new Error(error.message);
}
