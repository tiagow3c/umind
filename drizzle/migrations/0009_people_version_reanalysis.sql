ALTER TABLE public.meetings ADD COLUMN people_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_people_version(_meeting uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_workspace_member((SELECT workspace_id FROM public.meetings WHERE id = _meeting)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.meetings
  SET people_version = people_version + 1,
      status = 'processing'
  WHERE id = _meeting AND status IN ('review_ready', 'completed');
  UPDATE public.analyses SET stale = true WHERE meeting_id = _meeting;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_people_version(uuid) TO authenticated;