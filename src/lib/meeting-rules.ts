export type MeetingStatus =
  | "draft" | "consent_pending" | "recording" | "paused" | "uploading" | "processing"
  | "review_ready" | "completed" | "failed" | "deleting" | "deleted";

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  draft: "Rascunho",
  consent_pending: "Aguardando consentimento",
  recording: "Gravando",
  paused: "Pausada",
  uploading: "Enviando",
  processing: "Processando",
  review_ready: "Pronta para revisão",
  completed: "Concluída",
  failed: "Falhou",
  deleting: "Excluindo",
  deleted: "Excluída",
};

const TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  draft: ["consent_pending", "recording", "uploading", "deleting"],
  consent_pending: ["recording", "uploading", "deleting"],
  recording: ["paused", "uploading", "deleting"],
  paused: ["recording", "uploading", "deleting"],
  uploading: ["processing", "failed", "deleting"],
  processing: ["review_ready", "failed", "deleting"],
  review_ready: ["completed", "processing", "deleting"],
  completed: ["processing", "deleting"],
  failed: ["processing", "deleting"],
  deleting: ["deleted"],
  deleted: [],
};

export function canTransition(from: MeetingStatus, to: MeetingStatus) {
  return TRANSITIONS[from].includes(to);
}

export type Consent = { withdrawn_at: string | null };

export function canStartCapture(status: MeetingStatus, _consents: Consent[] = []) {
  return status === "draft" || status === "consent_pending";
}

export const MAX_DURATION_MS = 120 * 60 * 1000;
export const NOTICE_VERSION = "aviso-v1";

/** Placeholder title used until the AI names the meeting from its transcript. */
export const AUTO_TITLE = "Reunião sem título";
