CREATE TABLE public.meeting_shares (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  enabled boolean NOT NULL DEFAULT true,
  summary jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeting_shares TO authenticated;
GRANT ALL ON public.meeting_shares TO service_role;
ALTER TABLE public.meeting_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads share" ON public.meeting_shares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.owner_id = auth.uid()));

CREATE TABLE public.meeting_share_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meeting_shares(meeting_id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.meeting_share_comments(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  content text NOT NULL,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeting_share_comments TO authenticated;
GRANT ALL ON public.meeting_share_comments TO service_role;
ALTER TABLE public.meeting_share_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads comments" ON public.meeting_share_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.save_meeting_share(_meeting uuid, _summary jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _token text;
BEGIN
  SELECT workspace_id INTO _ws FROM meetings WHERE id = _meeting AND owner_id = auth.uid() AND deleted_at IS NULL AND status NOT IN ('deleting','deleted');
  IF _ws IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO meeting_shares(meeting_id, workspace_id, summary, created_by) VALUES (_meeting, _ws, _summary, auth.uid())
  ON CONFLICT (meeting_id) DO UPDATE SET summary = EXCLUDED.summary, enabled = true, updated_at = now()
  RETURNING token INTO _token;
  RETURN _token;
END $$;

CREATE OR REPLACE FUNCTION public.set_meeting_share_enabled(_meeting uuid, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE meeting_shares s SET enabled = _enabled, updated_at = now()
  FROM meetings m WHERE s.meeting_id = _meeting AND m.id = _meeting AND m.owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reply_share_comment(_meeting uuid, _parent uuid, _content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meetings WHERE id = _meeting AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(_content)) < 1 OR length(_content) > 2000 THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meeting_share_comments WHERE id = _parent AND meeting_id = _meeting) THEN RAISE EXCEPTION 'invalid'; END IF;
  SELECT coalesce(nullif(raw_user_meta_data->>'full_name',''), split_part(email,'@',1)) INTO _name FROM auth.users WHERE id = auth.uid();
  INSERT INTO meeting_share_comments(meeting_id, parent_id, author_name, content, is_owner)
  VALUES (_meeting, _parent, coalesce(_name,'Organizador'), trim(_content), true) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_summary(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', m.title, 'date', coalesce(m.started_at, m.created_at), 'summary', s.summary,
    'comments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'parent_id', c.parent_id, 'author_name', c.author_name, 'content', c.content, 'is_owner', c.is_owner, 'created_at', c.created_at) ORDER BY c.created_at) FROM meeting_share_comments c WHERE c.meeting_id = s.meeting_id), '[]'::jsonb))
  FROM meeting_shares s JOIN meetings m ON m.id = s.meeting_id
  WHERE s.token = _token AND s.enabled AND m.deleted_at IS NULL AND m.status NOT IN ('deleting','deleted');
$$;

CREATE OR REPLACE FUNCTION public.add_public_comment(_token text, _name text, _content text, _parent uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _meeting uuid; _id uuid;
BEGIN
  SELECT s.meeting_id INTO _meeting FROM meeting_shares s JOIN meetings m ON m.id = s.meeting_id
  WHERE s.token = _token AND s.enabled AND m.deleted_at IS NULL AND m.status NOT IN ('deleting','deleted');
  IF _meeting IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF length(trim(coalesce(_name,''))) < 1 OR length(_name) > 80 OR length(trim(coalesce(_content,''))) < 1 OR length(_content) > 2000 THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meeting_share_comments WHERE id = _parent AND meeting_id = _meeting) THEN RAISE EXCEPTION 'invalid'; END IF;
  IF (SELECT count(*) FROM meeting_share_comments WHERE meeting_id = _meeting AND created_at > now() - interval '1 minute') >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO meeting_share_comments(meeting_id, parent_id, author_name, content) VALUES (_meeting, _parent, trim(_name), trim(_content)) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.save_meeting_share(uuid, jsonb), public.set_meeting_share_enabled(uuid, boolean), public.reply_share_comment(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meeting_share(uuid, jsonb), public.set_meeting_share_enabled(uuid, boolean), public.reply_share_comment(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_summary(text), public.add_public_comment(text, text, text, uuid) TO anon, authenticated;