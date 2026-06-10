GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_sessions TO authenticated;

DROP POLICY IF EXISTS "Public can insert upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Public can read upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Public can update upload sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Public can delete upload sessions" ON public.upload_sessions;

CREATE POLICY "Public can insert upload sessions" ON public.upload_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can read upload sessions" ON public.upload_sessions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can update upload sessions" ON public.upload_sessions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete upload sessions" ON public.upload_sessions
  FOR DELETE TO anon, authenticated USING (true);