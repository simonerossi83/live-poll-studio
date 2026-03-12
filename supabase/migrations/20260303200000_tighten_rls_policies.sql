-- ==========================================================================
-- Tighten RLS policies for security hardening
-- ==========================================================================
-- CONTEXT: The original policies allowed ANY anonymous user to
-- INSERT/UPDATE/DELETE questions and DELETE answers.  This means
-- anyone who inspects the browser's Supabase anon key can wipe or
-- manipulate the entire quiz.
--
-- FIX:  Questions write operations (INSERT/UPDATE/DELETE) are now
-- restricted to the `service_role` JWT (i.e. server-side / admin
-- API calls only).  The anon key can only SELECT.
--
-- Answers: INSERT is restricted so the student_id must reference an
-- existing student, and DELETE is restricted to service_role.
-- ==========================================================================

-- ---- QUESTIONS ----

-- Drop the overly-permissive policies
DROP POLICY IF EXISTS "Anyone can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Anyone can update questions" ON public.questions;
DROP POLICY IF EXISTS "Anyone can delete questions" ON public.questions;

-- Only service_role (server-side / admin) can mutate questions
CREATE POLICY "Service role can insert questions"
  ON public.questions FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

CREATE POLICY "Service role can update questions"
  ON public.questions FOR UPDATE
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

CREATE POLICY "Service role can delete questions"
  ON public.questions FOR DELETE
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );


-- ---- ANSWERS ----

-- Drop the overly-permissive delete policy
DROP POLICY IF EXISTS "Anyone can delete answers" ON public.answers;

-- Tighten INSERT: student_id must exist in students table
DROP POLICY IF EXISTS "Anyone can insert answers" ON public.answers;
CREATE POLICY "Students can insert their own answers"
  ON public.answers FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id)
  );

-- Only service_role can delete answers (admin reset feature)
CREATE POLICY "Service role can delete answers"
  ON public.answers FOR DELETE
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );


-- ---- STUDENTS ----

-- Rate-limit protection: limit students to reasonable creation
-- (RLS can't enforce rate limits directly, but we ensure the policy
--  requires a valid school reference)
DROP POLICY IF EXISTS "Anyone can create a student session" ON public.students;
CREATE POLICY "Anyone can create a student session with valid school"
  ON public.students FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.schools WHERE id = school_id)
  );
