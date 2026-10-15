CREATE TABLE public.person_voiceprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  speaker_id uuid,
  voiceprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, speaker_id)
);
GRANT SELECT, DELETE ON public.person_voiceprints TO authenticated;
GRANT ALL ON public.person_voiceprints TO service_role;
ALTER TABLE public.person_voiceprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read voiceprints" ON public.person_voiceprints FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "members delete voiceprints" ON public.person_voiceprints FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE INDEX person_voiceprints_ws ON public.person_voiceprints(workspace_id);