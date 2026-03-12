-- ==========================================================================
-- Restore anon-accessible write policies for questions table
-- ==========================================================================
-- The previous migration (20260303200000) restricted question mutations to
-- service_role only.  However the admin dashboard runs entirely client-side
-- using the anon key — there is no server component or authentication layer.
-- Until a proper admin auth flow is added, we must allow the anon key to
-- manage questions so the admin dashboard works.
--
-- NOTE: This means anyone with the anon key can modify questions.
-- A future improvement should add Supabase Auth with an admin role and
-- restrict these policies to authenticated admin users only.
-- ==========================================================================

-- Drop the service_role-only policies
DROP POLICY IF EXISTS "Service role can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Service role can update questions" ON public.questions;
DROP POLICY IF EXISTS "Service role can delete questions" ON public.questions;

-- Restore open policies (same as original migration)
CREATE POLICY "Anyone can insert questions"
  ON public.questions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update questions"
  ON public.questions FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete questions"
  ON public.questions FOR DELETE
  USING (true);
