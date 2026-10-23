CREATE TABLE public.voice_enrollments (
 speaker_id uuid PRIMARY KEY REFERENCES public.speakers(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','unknown')),
 media_url text,
 job_id text,
 reason text,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.voice_enrollments TO authenticated;
GRANT ALL ON public.voice_enrollments TO service_role;
ALTER TABLE public.voice_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_enrollments_visible ON public.voice_enrollments FOR SELECT TO authenticated USING (public.meeting_visible(meeting_id));