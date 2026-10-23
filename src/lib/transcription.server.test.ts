import { describe, expect, it, vi } from "vitest";
vi.mock("@lovable.dev/ai-gateway", () => ({ GatewayError: class extends Error {}, transcribeAudioStream: vi.fn() }));
import { transcribeAudioStream } from "@lovable.dev/ai-gateway";
import { audioFilename, transcribeChunk } from "./transcription.server";

describe("audio upload format", () => {
  it("keeps iPhone MP4 instead of labeling it WebM", () => expect(audioFilename("audio/mp4")).toBe("audio.mp4"));
  it("keeps browser WebM with codec parameters", () => expect(audioFilename("audio/webm;codecs=opus")).toBe("audio.webm"));
  it("sends the real file type and Portuguese through the SDK", async () => {
    vi.mocked(transcribeAudioStream).mockResolvedValueOnce((async function* () { yield { type: "transcript.text.done", text: "fala válida" }; })() as never);
    expect(await transcribeChunk(new Blob(["audio"], { type: "audio/mp4" }))).toBe("fala válida");
    const request = vi.mocked(transcribeAudioStream).mock.calls[0]?.[0];
    expect(request?.file).toMatchObject({ name: "audio.mp4", type: "audio/mp4" });
    expect(request?.model).toBe("openai/gpt-transcribe");
    expect(request).toHaveProperty("language", "pt");
  });
});