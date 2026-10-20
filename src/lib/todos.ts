import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayForTask, isoDay } from "@/lib/todo-rules";

export const todosQuery = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    const { data, error } = await supabase.from("todos").select("*").order("position");
    if (error) throw new Error(error.message);
    return data;
  },
});

async function workspaceId() {
  const { data, error } = await supabase.from("workspaces").select("id").order("created_at").limit(1).single();
  if (error || !data) throw new Error("workspace");
  return data.id;
}

export async function addTodo(title: string, day: string, taskId: string | null = null) {
  const t = title.trim().slice(0, 500);
  if (!t) return;
  const { error } = await supabase.from("todos").insert({ workspace_id: await workspaceId(), title: t, day, task_id: taskId, position: Date.now() });
  if (error) throw new Error(error.message);
}

export async function updateTodo(id: string, patch: { title?: string; day?: string; done_at?: string | null; position?: number }) {
  const { error } = await supabase.from("todos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTodo(id: string) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Puts a meeting task on the agenda (its due day, or today). Returns false when it was already there. */
export async function addTaskToAgenda(task: { id: string; title: string; due_date: string | null }) {
  const { data } = await supabase.from("todos").select("id").eq("task_id", task.id).limit(1);
  if (data?.length) return false;
  await addTodo(task.title, dayForTask(task.due_date, isoDay(new Date())), task.id);
  return true;
}
