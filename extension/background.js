// All calls to the Ata app go through here (no CORS limits for the extension).
const APP = "https://umind.lovable.app";

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
    if (msg.type === "lookup") return call("lookup", null, msg.body);
    if (msg.type === "heartbeat") return call("heartbeat", msg.params);
    if (msg.type === "start") return call("start", null, msg.body);
    if (msg.type === "part") {
      const key = `pending:${msg.params.recording}:${msg.params.seq}`;
      await chrome.storage.local.set({ [key]: msg });
      let last;
      for (let i = 0; i < 4; i++) {
        try { const result = await call("part", msg.params, b64ToBytes(msg.data), true); await chrome.storage.local.remove(key); return result; }
        catch (e) { last = e; await new Promise((r) => setTimeout(r, 1000 * 2 ** i)); }
      }
      throw last;
    }
    if (msg.type === "finish") {
      await chrome.storage.local.set({ [`finish:${msg.params.recording}`]: msg });
      await drain(msg.params.recording);
      return { ok: true, meetingId: msg.meetingId };
    }
    if (msg.type === "open") { await chrome.tabs.create({ url: `${APP}/reunioes/${msg.meetingId}` }); return { ok: true }; }
    throw new Error("unknown");
  })().then((r) => reply({ ok: true, data: r }), (e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});

// Toolbar badge: red "REC" while recording, green dot when connected.
async function badge() {
  const { token, recording } = await chrome.storage.local.get(["token", "recording"]);
  if (recording) { chrome.action.setBadgeText({ text: "REC" }); chrome.action.setBadgeBackgroundColor({ color: "#E5484D" }); }
  else if (token) { chrome.action.setBadgeText({ text: "●" }); chrome.action.setBadgeBackgroundColor({ color: "#2F9E6B" }); }
  else chrome.action.setBadgeText({ text: "" });
}
chrome.storage.onChanged.addListener(badge);
chrome.runtime.onStartup.addListener(badge);
chrome.runtime.onInstalled.addListener(badge);

// Durable pending uploads survive a closed Meet tab or service-worker suspension.
let draining = false;
async function drain(onlyRecording) {
  if (draining) throw new Error("upload_busy");
  draining = true;
  try {
    const stored = await chrome.storage.local.get(null);
    const parts = Object.entries(stored).filter(([k, v]) => k.startsWith("pending:") && (!onlyRecording || v.params.recording === onlyRecording)).sort((a, b) => Number(a[1].params.seq) - Number(b[1].params.seq));
    for (const [key, msg] of parts) { await call("part", msg.params, b64ToBytes(msg.data), true); await chrome.storage.local.remove(key); }
    for (const [key, msg] of Object.entries(stored)) {
      if (!key.startsWith("finish:") || (onlyRecording && msg.params.recording !== onlyRecording)) continue;
      await call("finish", msg.params, msg.body); await chrome.storage.local.remove(key);
    }
  } finally { draining = false; }
}
chrome.alarms.create("recover-capture", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => { void drain().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { void drain().catch(() => {}); void chrome.storage.local.remove("recording"); });
