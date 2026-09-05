ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shirt_size text,
  ADD COLUMN IF NOT EXISTS pants_size text;
