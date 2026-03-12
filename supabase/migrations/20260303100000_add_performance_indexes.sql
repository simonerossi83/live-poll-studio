-- Performance indexes for 200+ concurrent users

-- Fast lookup of the currently active question
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON public.questions (is_active) WHERE is_active = true;

-- Fast lookup of answers by question (used on every poll/realtime refresh)
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers (question_id);

-- Fast lookup of student → school mapping
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students (school_id);

-- Fast duplicate-answer check per student per question (covered by UNIQUE already, but explicit)
-- The UNIQUE(question_id, student_id) already creates this; skip if exists
-- CREATE INDEX IF NOT EXISTS idx_answers_student_question ON public.answers (student_id, question_id);

-- Ensure schools realtime is enabled (used by rank page)
ALTER PUBLICATION supabase_realtime ADD TABLE public.schools;
