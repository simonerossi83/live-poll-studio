-- Add response_time_ms to answers (milliseconds from question shown to answer submitted)
ALTER TABLE public.answers ADD COLUMN response_time_ms INTEGER;
