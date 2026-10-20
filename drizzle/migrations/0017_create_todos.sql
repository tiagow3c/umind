CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  day date NOT NULL DEFAULT current_date,
  position double precision NOT NULL DEFAULT 0,
  done_at timestamptz,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX todos_user_day ON public.todos (user_id, day);
CREATE UNIQUE INDEX todos_task_unique ON public.todos (user_id, task_id) WHERE task_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own todos select" ON public.todos FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY "own todos insert" ON public.todos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY "own todos update" ON public.todos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY "own todos delete" ON public.todos FOR DELETE TO authenticated USING (user_id = auth.uid());