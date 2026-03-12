import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. " +
    "Copy .env.example to .env.local and fill in your project credentials."
  );
}

if (!SUPABASE_URL.startsWith("https://")) {
  throw new Error("VITE_SUPABASE_URL must use HTTPS.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      // Allow more events per second for 200+ users
      eventsPerSecond: 20,
    },
  },
  // Disable auth auto-refresh for anonymous usage (saves network traffic)
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});