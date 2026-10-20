export type AssistantMessage = { role: "user" | "assistant"; content: string; meetingId: string | null };

export function meetingContextFromPath(pathname: string): string | null {
  const match = /^\/reunioes\/([0-9a-f-]{36})\/?$/i.exec(pathname);
  return match?.[1] ?? null;
}

export function historyForContext(messages: AssistantMessage[], meetingId: string | null) {
  return messages.filter((message) => message.meetingId === meetingId).slice(-12);
}