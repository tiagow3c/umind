import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";

const haltSource = readFileSync("extension/capture-stop.js", "utf8");
const contentSource = readFileSync("extension/content.js", "utf8");
const rulesSource = readFileSync("extension/call-state.js", "utf8");

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("immediate Meet capture shutdown", () => {
  it("releases input and output tracks and context before the final recorder event", async () => {
    const input = { stop: vi.fn() }, output = { stop: vi.fn() };
    const recorder = new EventTarget();
    Object.assign(recorder, { state: "recording", stop: vi.fn(), stream: { getTracks: () => [output] } });
    const ctx = { state: "running", close: vi.fn(() => Promise.resolve()) };
    const scope = runInNewContext(haltSource + ";globalThis.AtaMeetCapture;");
    const stopped = scope.halt({ rec: recorder, streams: [{ getTracks: () => [input] }], ctx });
    expect(input.stop).toHaveBeenCalledTimes(1);
    expect(output.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    let finished = false;
    void stopped.then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    recorder.dispatchEvent(new Event("stop"));
    await stopped;
    expect(finished).toBe(true);
  });

  async function capture() {
    document.body.innerHTML = '<button aria-label="Sair da chamada">Sair</button>';
    const input = Object.assign(new EventTarget(), { stop: vi.fn() });
    const micTrack = { stop: vi.fn() }, output = { stop: vi.fn() };
    const tab = { getTracks: () => [input], getAudioTracks: () => [input], getVideoTracks: () => [] };
    const mic = { getTracks: () => [micTrack] };
    const messages: Array<{ type: string; params?: { end?: string }; body?: { durationMs?: number } }> = [];
    let recorder: Recorder | undefined;
    let tick: (() => void) | undefined;
    let acknowledgeUpload: (() => void) | undefined;
    const close = vi.fn(() => Promise.resolve());
    class Recorder extends EventTarget {
      static isTypeSupported() { return true; }
      state = "inactive";
      ondataavailable?: (event: { data: NodeBlob }) => void;
      constructor(public stream: { getTracks: () => unknown[] }) { super(); recorder = this; }
      start() { this.state = "recording"; }
      stop = vi.fn(() => { this.state = "inactive"; });
      final() { this.ondataavailable?.({ data: new NodeBlob(["final-audio"]) }); this.dispatchEvent(new Event("stop")); }
    }
    class Context {
      state = "running"; close = close;
      createMediaStreamDestination() { return { stream: { getTracks: () => [output] } }; }
      createMediaStreamSource() { return { connect: vi.fn() }; }
    }
    const observers: MutationObserver[] = [];
    class Observer extends MutationObserver {
      constructor(callback: MutationCallback) { super(callback); observers.push(this); }
    }
    runInNewContext(rulesSource + haltSource + contentSource, {
      document, window, Element, MutationObserver: Observer, queueMicrotask,
      navigator: { mediaDevices: { getDisplayMedia: async () => tab, getUserMedia: async () => mic } },
      location: { href: "https://meet.google.com/abc-defg-hij" },
      chrome: {
        storage: { local: { get: async () => ({ token: "test-only" }), set: vi.fn(), remove: vi.fn() } },
        runtime: { sendMessage: (msg: typeof messages[number], callback: (r: unknown) => void) => {
          messages.push(msg);
          if (msg.type === "part") { acknowledgeUpload = () => callback({ ok: true, data: {} }); return; }
          callback({ ok: true, data: msg.type === "start" ? { recordingId: "recording-test", meetingId: "meeting-test", remainingMs: 7200000 } : { meeting: null, active: true } });
        } },
      },
      AudioContext: Context, MediaRecorder: Recorder, MediaStream: class {}, Date, Intl,
      crypto: { randomUUID: () => "request-test" }, btoa, Uint8Array,
      setInterval: (fn: () => void, ms: number) => { if (ms === 1500) tick = fn; return 1; },
      clearInterval: vi.fn(), setTimeout: vi.fn(), alert: vi.fn(), confirm: () => false,
    });
    tick?.();
    document.querySelector<HTMLButtonElement>(".ata-meet-action")?.click();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(recorder?.state).toBe("recording");
    return { input, micTrack, output, close, messages, getRecorder: () => recorder, ack: () => acknowledgeUpload?.(), cleanup: () => observers.forEach((o) => o.disconnect()) };
  }

  for (const action of ["click", "keyboard", "ended"] as const) {
    it(`stops immediately on ${action} with Ata minimized, then preserves the last audio`, async () => {
      const s = await capture();
      try {
        document.querySelector<HTMLButtonElement>(".ata-meet-minimize")?.click();
        const leave = document.querySelector<HTMLButtonElement>('[aria-label="Sair da chamada"]');
        if (action === "click") leave?.click();
        if (action === "keyboard") leave?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        if (action === "ended") {
          // Meet often changes existing text nodes rather than replacing a whole element.
          Object.defineProperty(document.body, "innerText", { configurable: true, get: () => "Você saiu da reunião" });
          document.body.append(document.createTextNode("Você saiu da reunião"));
          for (let i = 0; i < 4; i++) await Promise.resolve();
        }
        expect(s.getRecorder()?.stop).toHaveBeenCalledTimes(1);
        expect(s.input.stop).toHaveBeenCalledTimes(1);
        expect(s.micTrack.stop).toHaveBeenCalledTimes(1);
        expect(s.output.stop).toHaveBeenCalledTimes(1);
        expect(s.close).toHaveBeenCalledTimes(1);
        expect(s.messages.filter((m) => m.type === "finish")).toHaveLength(0);
        s.getRecorder()?.final();
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(s.messages.filter((m) => m.type === "part")).toHaveLength(1);
        expect(s.messages.filter((m) => m.type === "finish")).toHaveLength(0);
        s.ack();
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(s.messages.filter((m) => m.type === "finish")).toHaveLength(1);
        expect(s.messages.find((m) => m.type === "finish")?.body?.durationMs).toBe(Number(s.messages.find((m) => m.type === "part")?.params?.end));
      } finally { s.cleanup(); delete (document.body as Partial<HTMLElement>).innerText; }
    });
  }
});