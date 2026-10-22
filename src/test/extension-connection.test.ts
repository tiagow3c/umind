import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const background = readFileSync("extension/background.js", "utf8");
const popup = readFileSync("extension/popup.js", "utf8");

describe("extension connection", () => {
  it("uses the live app origin allowed by the manifest", async () => {
    const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    const listener = { addListener: vi.fn() };
    const context = {
      fetch, URLSearchParams,
      chrome: {
        storage: { local: { get: async () => ({ token: "test-code" }) }, onChanged: listener },
        runtime: { onMessage: listener, onStartup: listener, onInstalled: listener },
        alarms: { create: vi.fn(), onAlarm: listener },
      },
    };
    await runInNewContext(background + '\ncall("check");', context);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://umind.lovable.app/api/public/extension?action=check");
    expect(manifest.host_permissions).toEqual(["https://umind.lovable.app/*"]);
  });

  async function check(error: string) {
    const nodes = new Map<string, { hidden: boolean; textContent: string; focus: () => void; addEventListener: () => void }>();
    const node = (id: string) => {
      if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: "", focus: vi.fn(), addEventListener: vi.fn() });
      return nodes.get(id);
    };
    await runInNewContext(popup.replace("void refresh();", "refresh();"), {
      document: { getElementById: node },
      chrome: {
        storage: { local: { get: async () => ({ token: "existing-code" }) } },
        runtime: { sendMessage: (_msg: unknown, reply: (r: unknown) => void) => reply({ ok: false, error }) },
      },
      setInterval: vi.fn(), clearInterval: vi.fn(), Date,
    });
    return nodes;
  }

  it("does not request a replacement code on network failure", async () => {
    const nodes = await check("Failed to fetch");
    expect(nodes.get("form")?.hidden).toBe(true);
    expect(nodes.get("connected")?.hidden).toBe(false);
  });

  it("requests a replacement only when authentication is rejected", async () => {
    const nodes = await check("unauthorized");
    expect(nodes.get("form")?.hidden).toBe(false);
    expect(nodes.get("connected")?.hidden).toBe(true);
  });
});