DROP POLICY IF EXISTS "authenticated read job_state" ON public.job_state;
REVOKE ALL ON public.job_state FROM anon, authenticated;
GRANT ALL ON public.job_state TO service_role;