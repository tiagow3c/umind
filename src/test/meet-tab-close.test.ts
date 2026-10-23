import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("extension/background.js", "utf8");

function harness() {
  const stored: Record<string, any> = { token: "test-only" };
  const listeners: Record<string, (...args: any[]) => any> = {};
  const event = (name: string) => ({ addListener: (fn: (...args: any[]) => any) => { listeners[name] = fn; } });
  let tab: { url: string } | null = { url: "https://meet.google.com/abc-defg-hij" };
  let fail = false;
  const calls: { action: string; body: any }[] = [];
  const fetch = vi.fn(async (value: string, init: { body: string }) => {
    if (fail) throw new Error("offline");
    const action = new URL(value).searchParams.get("action") ?? "";
    calls.push({ action, body: action === "part" ? null : JSON.parse(init.body) });
    return { ok: true, json: async () => action === "start" ? { recordingId: "rec-1", meetingId: "meeting-1" } : { ok: true } };
  });
  runInNewContext(source, {
    fetch, URL, URLSearchParams, Uint8Array, atob, setTimeout,
    chrome: {
      storage: { local: {
        get: async (key: string | null) => key == null ? { ...stored } : { [key]: stored[key] },
        set: async (values: Record<string, any>) => { Object.assign(stored, values); },
        remove: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]; },
      }, onChanged: event("changed") },
      runtime: { onMessage: event("message"), onStartup: event("startup"), onInstalled: event("installed") },
      tabs: { get: async () => { if (!tab) throw new Error("closed"); return tab; }, onRemoved: event("removed"), onUpdated: event("updated") },
      alarms: { create: vi.fn(), onAlarm: event("alarm") },
      action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    },
  });
  const send = (msg: any) => new Promise<any>((resolve) => listeners["message"]?.(msg, { tab: { id: 7 } }, resolve));
  const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
  const start = () => send({ type: "start", body: { meetUrl: "https://meet.google.com/abc-defg-hij" } });
  return { stored, calls, listeners, send, start, settle, offline: (value: boolean) => { fail = value; }, close: () => { tab = null; listeners["removed"]?.(7); } };
}

describe("durable Meet tab closure", () => {
  it("persists the session before replying and finishes when the tab closes", async () => {
    const h = harness();
    expect((await h.start()).ok).toBe(true);
    expect(h.stored["capture:rec-1"].tabId).toBe(7);
    h.close(); await h.settle();
    expect(h.calls.find((c) => c.action === "finish")?.body.interrupted).toBe(true);
    expect(h.stored["capture:rec-1"]).toBeUndefined();
  });
  it("drains saved audio before interrupted finish", async () => {
    const h = harness(); await h.start();
    h.stored["pending:rec-1:1"] = { params: { recording: "rec-1", seq: "1" }, data: btoa("audio") };
    h.close(); await h.settle();
    expect(h.calls.map((c) => c.action)).toEqual(["start", "part", "finish"]);
  });
  it("keeps a durable finish offline and retries from the alarm without the Meet page", async () => {
    const h = harness(); await h.start(); h.offline(true);
    h.close(); await h.settle();
    expect(h.stored["finish:rec-1"].body.interrupted).toBe(true);
    h.offline(false); h.listeners["alarm"]?.(); await h.settle();
    expect(h.calls.filter((c) => c.action === "finish")).toHaveLength(1);
    expect(h.stored["finish:rec-1"]).toBeUndefined();
  });
  it("ignores tab visibility changes but ends capture on navigation", async () => {
    const h = harness(); await h.start();
    h.listeners["updated"]?.(7, { highlighted: false }); await h.settle();
    expect(h.calls.filter((c) => c.action === "finish")).toHaveLength(0);
    h.listeners["updated"]?.(7, { status: "loading", url: "https://example.com" }); await h.settle();
    expect(h.calls.filter((c) => c.action === "finish")).toHaveLength(1);
  });
  it("preserves interrupted status when a late recorder finish arrives", async () => {
    const h = harness(); await h.start(); h.offline(true); h.close(); await h.settle();
    await h.send({ type: "finish", params: { recording: "rec-1" }, body: { durationMs: 30000 } });
    expect(h.stored["finish:rec-1"].body.interrupted).toBe(true);
    h.offline(false); h.listeners["alarm"]?.(); await h.settle();
    expect(h.calls.find((c) => c.action === "finish")?.body.durationMs).toBe(30000);
  });
});