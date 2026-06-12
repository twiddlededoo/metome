ALTER TABLE public.upload_sessions ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_sessions TO authenticated;
GRANT ALL ON public.upload_sessions TO service_role;