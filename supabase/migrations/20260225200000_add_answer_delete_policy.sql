-- Allow admins (using anon key) to delete answers for quiz resets
CREATE POLICY "Anyone can delete answers" ON public.answers FOR DELETE USING (true);
