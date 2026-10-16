import { afterEach, describe, expect, it, vi } from "vitest";
import { submitDiarize, submitIdentify, uploadMedia } from "./pyannote.server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("pyannote API requests", () => {
  it("requests transcription only through diarize", async () => {
    vi.stubEnv("PYANNOTE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ jobId: "transcription-job" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitDiarize("media://ata/saved")).toBe("transcription-job");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.pyannote.ai/v1/diarize");
    expect(JSON.parse(init.body)).toEqual({ url: "media://ata/saved", model: "precision-3", exclusive: true, minSpeakers: 2, transcription: true, transcriptionConfig: { model: "faster-whisper-large-v3-turbo" } });
  });
  it("identifies voices without unsupported transcription parameters", async () => {
    vi.stubEnv("PYANNOTE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ jobId: "identity-job" }));
    vi.stubGlobal("fetch", fetchMock);
    const voices = Array.from({ length: 51 }, (_, i) => ({ label: `person-${i}`, voiceprint: `voice-${i}` }));
    expect(await submitIdentify("media://ata/saved", voices)).toBe("identity-job");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.pyannote.ai/v1/identify");
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty("transcription");
    expect(body).not.toHaveProperty("transcriptionConfig");
    expect(body.voiceprints).toHaveLength(50);
    expect(body.matching).toEqual({ threshold: 70, exclusive: true });
  });
  it("uploads saved audio bytes unchanged", async () => {
    vi.stubEnv("PYANNOTE_API_KEY", "test-key");
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ url: "https://media.example/upload" })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await uploadMedia("saved", audio)).toBe("media://ata/saved");
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(audio);
    expect(fetchMock.mock.calls[1]?.[1].method).toBe("PUT");
  });
});