-- ==========================================================================
-- Restore anon-accessible DELETE policy for answers table
-- ==========================================================================
-- Migration 20260303200000 restricted answer deletion to service_role only.
-- However, the admin dashboard runs entirely client-side using the anon key
-- (no server component or auth layer), so the admin reset feature silently
-- deleted 0 rows — the DELETE query returned no error but also removed nothing.
--
-- Migration 20260303300000 already fixed the same issue for the questions
-- table but missed answers.  This migration applies the same fix.
--
-- NOTE: Anyone with the anon key can delete answers.  A future improvement
-- should add Supabase Auth with an admin role and restrict this policy to
-- authenticated admin users only.
-- ==========================================================================

-- Drop the service_role-only policy that broke the admin reset feature
DROP POLICY IF EXISTS "Service role can delete answers" ON public.answers;

-- Restore the original open policy (consistent with 20260225200000)
CREATE POLICY "Anyone can delete answers"
  ON public.answers FOR DELETE
  USING (true);
