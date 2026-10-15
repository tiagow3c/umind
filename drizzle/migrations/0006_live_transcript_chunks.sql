CREATE TABLE public.live_transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  start_ms bigint NOT NULL DEFAULT 0,
  end_ms bigint NOT NULL DEFAULT 0,
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recording_id, sequence)
);
GRANT SELECT ON public.live_transcript_chunks TO authenticated;
GRANT ALL ON public.live_transcript_chunks TO service_role;
ALTER TABLE public.live_transcript_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read live chunks" ON public.live_transcript_chunks FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND public.meeting_visible(meeting_id));