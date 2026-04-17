
CREATE TABLE public.upload_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'uploaded', 'expired')),
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create upload sessions"
  ON public.upload_sessions FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anyone can read upload sessions"
  ON public.upload_sessions FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anyone can update upload sessions"
  ON public.upload_sessions FOR UPDATE
  TO anon USING (true);

CREATE POLICY "Anyone can delete upload sessions"
  ON public.upload_sessions FOR DELETE
  TO anon USING (true);

CREATE INDEX idx_upload_sessions_session_id ON public.upload_sessions (session_id);
