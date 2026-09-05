ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_number text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_id_number_unique
  ON public.profiles (id_number)
  WHERE id_number IS NOT NULL;
