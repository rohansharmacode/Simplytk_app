import { localDay, stageToStatus, type ApplicationStage } from '@/lib/applications/stages';
import { supabase } from '@/lib/supabase';

/**
 * The student's application tracker, straight from the website's `applications` table.
 * Row-level security keeps each student to their own rows, and the writes mirror
 * src/lib/user-tracker.ts on the site so the two stay in step.
 */
export type Application = {
  id: string;
  job_id: string | null;
  kind: string | null;
  status: string | null;
  stage_completed_at: string | null;
  applied_on: string | null;
  updated_at: string | null;
  manual_company: string | null;
  manual_title: string | null;
  manual_url: string | null;
  starred: boolean | null;
  jobs: {
    id: string;
    title: string;
    deadline: string | null;
    apply_url: string;
    status: string | null;
    programme_type: string | null;
    companies: { name: string; slug: string; logo_url: string | null } | null;
  } | null;
};

const COLUMNS =
  'id, job_id, kind, status, stage_completed_at, applied_on, updated_at, manual_company, manual_title, manual_url, starred, jobs(id, title, deadline, apply_url, status, programme_type, companies(name, slug, logo_url))';

export async function fetchApplications(): Promise<Application[]> {
  const { data, error } = await supabase.from('applications').select(COLUMNS).order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Application[];
}

/** Move an application to a stage, the way the site's stage dropdown does. */
export async function setStage(application: Application, stage: ApplicationStage, now = new Date()): Promise<void> {
  const { status, completed } = stageToStatus(stage);
  const stamp = now.toISOString();
  const { error } = await supabase
    .from('applications')
    .update({ status, stage_completed_at: completed ? stamp : null, updated_at: stamp })
    .eq('id', application.id);
  if (error) throw new Error(error.message);
  if (status === 'applied' && !application.applied_on) {
    // Only an empty date is written, as on the site.
    await supabase.from('applications').update({ applied_on: localDay(now) }).eq('id', application.id).is('applied_on', null);
  }
}

/** Add an opening to the tracker. One already there is left as it is: move it with setStage. */
export async function trackOpening(jobId: string, stage: ApplicationStage, now = new Date()): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Sign in to track applications.');
  const { status, completed } = stageToStatus(stage);
  const stamp = now.toISOString();
  const { error } = await supabase.from('applications').upsert(
    {
      user_id: user.user.id,
      job_id: jobId,
      status,
      updated_at: stamp,
      ...(completed ? { stage_completed_at: stamp } : {}),
      ...(status === 'applied' ? { applied_on: localDay(now) } : {}),
    },
    { onConflict: 'user_id,job_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function removeApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** What to call a row: the opening's firm and title, or what the student typed. */
export function describe(application: Application): { firm: string; title: string; url: string | null } {
  return {
    firm: application.jobs?.companies?.name ?? application.manual_company ?? 'Application',
    title: application.jobs?.title ?? application.manual_title ?? '',
    url: application.jobs?.apply_url ?? application.manual_url,
  };
}

/** The student's row for an opening, or null when they aren't tracking it. */
export async function fetchApplicationForJob(jobId: string): Promise<Application | null> {
  const { data, error } = await supabase.from('applications').select(COLUMNS).eq('job_id', jobId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Application | null) ?? null;
}

/** Startup opportunities the student saved: event rows keyed by the opportunity's link. */
export async function fetchSavedOpportunityUrls(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('applications')
    .select('manual_url')
    .eq('kind', 'event')
    .is('job_id', null)
    .not('manual_url', 'is', null);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { manual_url: string }[]).map((row) => row.manual_url));
}

/** Save an opportunity to the tracker, as the website's opportunities board does. */
export async function saveOpportunity(input: { organiser: string; name: string; url: string }, now = new Date()) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Sign in to save opportunities.');
  const { error } = await supabase.from('applications').insert({
    user_id: user.user.id,
    job_id: null,
    kind: 'event',
    manual_company: input.organiser.trim(),
    manual_title: input.name.trim(),
    manual_url: input.url.trim(),
    status: 'not_started',
    applied_on: null,
    updated_at: now.toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function unsaveOpportunity(url: string) {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('kind', 'event')
    .is('job_id', null)
    .eq('manual_url', url);
  if (error) throw new Error(error.message);
}
