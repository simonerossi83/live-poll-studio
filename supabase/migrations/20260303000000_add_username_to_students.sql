-- Add username column to students (nullable for backward compatibility)
ALTER TABLE public.students ADD COLUMN username TEXT;

-- Enable realtime for students so Rank page can subscribe to new players
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
