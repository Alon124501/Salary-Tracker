-- Device tutorial videos shown in the Portal "Videos" tab.
-- Admin adds either an uploaded video file (tutorial-videos storage bucket,
-- create manually in Supabase dashboard — private, 200MB file size limit)
-- or a link (YouTube/Vimeo get embedded, everything else is a plain link).
CREATE TABLE tutorial_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  device_id UUID REFERENCES device_catalog(id) ON DELETE SET NULL,
  device_name_other TEXT,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'link')),
  storage_path TEXT,
  external_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorial_videos_read" ON tutorial_videos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tutorial_videos_admin" ON tutorial_videos FOR ALL USING (auth.role() = 'service_role');
