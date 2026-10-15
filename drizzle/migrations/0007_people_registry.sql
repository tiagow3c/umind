CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  is_self boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage people" ON public.people FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE INDEX people_ws_idx ON public.people(workspace_id);
CREATE TRIGGER touch_people BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.participants ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;
ALTER TABLE public.participants ADD COLUMN person_confirmed boolean NOT NULL DEFAULT false;
CREATE INDEX participants_person_idx ON public.participants(person_id);

CREATE OR REPLACE FUNCTION public.merge_people(_from uuid, _into uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare a public.people; b public.people;
begin
  select * into a from public.people where id = _from for update;
  select * into b from public.people where id = _into for update;
  if a.id is null or b.id is null or a.workspace_id <> b.workspace_id or not public.is_workspace_member(a.workspace_id) or _from = _into then
    raise exception 'not_found';
  end if;
  update public.participants set person_id = _into where person_id = _from;
  update public.people set aliases = (select array_agg(distinct x) from unnest(b.aliases || a.aliases || array[a.display_name]) x where x <> b.display_name),
    is_self = b.is_self or a.is_self where id = _into;
  delete from public.people where id = _from;
end $$;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid) TO authenticated;