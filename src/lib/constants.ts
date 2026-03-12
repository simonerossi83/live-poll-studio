// Admin password is read from the environment variable VITE_ADMIN_PASSWORD.
// Set it in a .env.local file (never commit that file).
//
// SECURITY NOTE: This password is embedded in the client-side JS bundle.
// It provides a basic deterrent but NOT real security.  For production,
// move admin auth to a server-side endpoint (e.g. Supabase Auth with
// a service_role key).
//
// Falls back to a placeholder so a missing env var causes an obvious mismatch
// rather than silently accepting any input.
export const ADMIN_PASSWORD: string =
  import.meta.env.VITE_ADMIN_PASSWORD || "__env_not_set__";

export const CHART_COLORS = [
  "hsl(243, 75%, 59%)",
  "hsl(173, 58%, 39%)",
  "hsl(35, 92%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 70%, 50%)",
];
