CREATE TABLE public.extension_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, DELETE ON public.extension_tokens TO authenticated;
GRANT ALL ON public.extension_tokens TO service_role;
ALTER TABLE public.extension_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens read" ON public.extension_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own tokens delete" ON public.extension_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());