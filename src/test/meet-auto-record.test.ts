import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("extension/call-state.js", "utf8") + readFileSync("extension/content.js", "utf8");
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

async function setup(enabled: boolean, markup: string) {
  document.body.innerHTML = markup;
  const display = vi.fn(async () => { throw new Error("picker cancelled for test"); });
  runInNewContext(source, {
    document, window, Element, queueMicrotask,
    MutationObserver: class { observe() {} },
    navigator: { mediaDevices: { getDisplayMedia: display } },
    location: { href: "https://meet.google.com/abc-defg-hij" },
    chrome: {
      storage: { local: { get: async () => ({ token: "test-only" }), set: vi.fn(), remove: vi.fn() } },
      runtime: { sendMessage: (_msg: unknown, cb: (value: unknown) => void) => cb({ ok: true, data: { autoRecord: enabled, meeting: null } }) },
    },
    AtaMeetCapture: { halt: vi.fn() },
    Date, setInterval: vi.fn(), setTimeout: vi.fn(), clearInterval: vi.fn(), alert: vi.fn(),
  });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return display;
}

describe("automatic recording on Meet entry", () => {
  it("starts without Gravar when auto-record is enabled and Meet uses role=button", async () => {
    const display = await setup(true, '<div role="button" aria-label="Participar agora"><span>Participar agora</span></div>');
    document.querySelector<HTMLElement>("span")?.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(display).toHaveBeenCalledTimes(1);
  });
  it("starts on keyboard entry when auto-record is enabled", async () => {
    const display = await setup(true, '<div role="button" aria-label="Pedir para participar"></div>');
    document.querySelector('[role="button"]')?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(display).toHaveBeenCalledTimes(1);
  });
  it("does not start automatically when disabled", async () => {
    const display = await setup(false, '<button aria-label="Participar agora">Participar agora</button>');
    document.querySelector<HTMLButtonElement>("button")?.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(display).not.toHaveBeenCalled();
  });
  it("opens only one picker for repeated entry clicks", async () => {
    const display = await setup(true, '<button aria-label="Join now">Join now</button>');
    document.querySelector<HTMLButtonElement>("button")?.click();
    document.querySelector<HTMLButtonElement>("button")?.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(display).toHaveBeenCalledTimes(1);
  });
});