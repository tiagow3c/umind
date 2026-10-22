import { STATUS_LABEL, type MeetingStatus } from "@/lib/meeting-rules";
import { cn } from "@/lib/utils";

const TONE: Partial<Record<MeetingStatus, string>> = {
  recording: "border-accent text-accent",
  uploading: "border-warning text-warning",
  processing: "border-warning text-warning",
  review_ready: "border-success text-success",
  completed: "border-success text-success",
  failed: "border-destructive text-destructive",
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", TONE[status] ?? "border-border text-muted-foreground")}>
      {status === "recording" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function formatDuration(ms: number | null | undefined) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where the conversation came from: Google Meet extension, imported file or the Ata recorder. */
export function SourceTag({ meeting }: { meeting: { source_type: string; meet_url?: string | null } }) {
  const label = meeting.meet_url ? "Meet" : meeting.source_type === "import" ? "Arquivo" : "Gravador";
  return <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{label}</span>;
}
