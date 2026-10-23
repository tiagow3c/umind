export function canEnrollVoice(part: { person_id: string | null; person_confirmed: boolean } | null, personId: string) {
  return part?.person_confirmed === true && part.person_id === personId;
}

export function voiceJobState(job: { status: string; output: Record<string, unknown> | null } | null) {
  if (!job || job.status === "pending" || job.status === "running" || job.status === "created") return { status: "pending" as const, voiceprint: null };
  const voiceprint = job.status === "succeeded" && typeof job.output?.["voiceprint"] === "string" ? job.output["voiceprint"] : null;
  return { status: voiceprint ? "succeeded" as const : "failed" as const, voiceprint };
}