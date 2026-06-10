-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Anyone can delete upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Anyone can read upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Anyone can update upload sessions" ON public.upload_sessions;

-- Revoke anon/authenticated access; only service_role (used by server functions via supabaseAdmin) may touch this table
REVOKE ALL ON public.upload_sessions FROM anon;
REVOKE ALL ON public.upload_sessions FROM authenticated;
GRANT ALL ON public.upload_sessions TO service_role;

-- RLS stays on with no policies => default deny for anon/authenticated
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;