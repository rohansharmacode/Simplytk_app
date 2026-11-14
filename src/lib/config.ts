/**
 * The website's Supabase project. The publishable key is the same one simplytk.com ships
 * in its own page bundle: it only allows what row-level security allows a visitor or a
 * signed-in student to do, so it is safe to build into the app.
 */
export const SUPABASE_URL = 'https://kfrlrioicoltydcmkpoi.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hNnlPAh4ZIFImgWU1p8gVg_SVEIuYOP';

/** Where supabase-js keeps the session on simplytk.com (sb-<project ref>-auth-token). */
export const SUPABASE_STORAGE_KEY = 'sb-kfrlrioicoltydcmkpoi-auth-token';
