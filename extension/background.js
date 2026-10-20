// All calls to the Ata app go through here (no CORS limits for the extension).
const APP = "https://idea-structurizer.lovable.app";

async function call(action, params, body, isBinary) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw new Error("no_token");
  const qs = new URLSearchParams({ action, ...(params || {}) });
  const res = await fetch(`${APP}/api/public/extension?${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": isBinary ? "application/octet-stream" : "application/json" },
    body: isBinary ? body : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `http_${res.status}`);
  return data;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    if (msg.type === "check") return call("check");
    if (msg.type === "start") return call("start", null, msg.body);
    if (msg.type === "part") {
      let last;
      for (let i = 0; i < 4; i++) {
        try { return await call("part", msg.params, b64ToBytes(msg.data), true); }
        catch (e) { last = e; await new Promise((r) => setTimeout(r, 1000 * 2 ** i)); }
      }
      throw last;
    }
    if (msg.type === "finish") return call("finish", msg.params, msg.body);
    if (msg.type === "open") { await chrome.tabs.create({ url: `${APP}/reunioes/${msg.meetingId}` }); return { ok: true }; }
    throw new Error("unknown");
  })().then((r) => reply({ ok: true, data: r }), (e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});
