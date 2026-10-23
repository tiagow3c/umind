// Runs inside Google Meet: shows "Gravar com Ata" during a call, records the call audio + your mic, uploads every 30 s.
(() => {
  const PART_MS = 30000;
  let state = { rec: null, recordingId: null, meetingId: null, seq: 1, startedAt: 0, partStart: 0, streams: [], ctx: null, pending: [] };

  const send = (msg) => new Promise((res, rej) => chrome.runtime.sendMessage(msg, (r) => (r && r.ok ? res(r.data) : rej(new Error((r && r.error) || "erro")))));

  const panel = document.createElement("aside");
  panel.className = "ata-meet-window";
  panel.setAttribute("aria-label", "Gravação com Ata");
  const header = document.createElement("div");
  header.className = "ata-meet-header";
  const brand = document.createElement("strong");
  brand.textContent = "Ata";
  const minimize = document.createElement("button");
  minimize.type = "button";
  minimize.className = "ata-meet-minimize";
  minimize.textContent = "−";
  minimize.title = "Minimizar";
  minimize.setAttribute("aria-label", "Minimizar Ata");
  header.append(brand, minimize);
  const info = document.createElement("div");
  info.className = "ata-meet-info";
  const statusText = document.createElement("span");
  const clock = document.createElement("span");
  clock.className = "ata-meet-clock";
  clock.hidden = true;
  info.append(statusText, clock);
  const btn = document.createElement("button");
  btn.className = "ata-meet-action";
  btn.type = "button";
  const icon = document.createElement("span");
  icon.className = "ata-meet-mic";
  icon.setAttribute("aria-hidden", "true");
  const buttonText = document.createElement("span");
  btn.append(icon, buttonText);
  panel.append(header, info, btn);
  const reopen = document.createElement("button");
  reopen.type = "button";
  reopen.className = "ata-meet-reopen";
  reopen.textContent = "Ata";
  reopen.title = "Abrir Ata";
  reopen.setAttribute("aria-label", "Abrir Ata");
  reopen.hidden = true;
  let minimized = false, starting = false, stopping = false, previous = null, lastCallSeen = 0, preparing = null;
  const resumeBtn = document.createElement("button");
  resumeBtn.type = "button"; resumeBtn.className = "ata-meet-action ata-meet-resume"; resumeBtn.textContent = "Retomar anterior"; resumeBtn.hidden = true;
  panel.append(resumeBtn);
  resumeBtn.addEventListener("click", () => void start(previous?.id));
  async function lookup() {
    try {
      const result = await send({ type: "lookup", body: { meetUrl: location.href } });
      previous = result.meeting;
      resumeBtn.hidden = !previous || !!state.rec || stopping;
      resumeBtn.title = previous ? `Retomar: ${previous.title}` : "";
      if (previous && !state.rec && !stopping) { buttonText.textContent = "Gravar nova reunião"; statusText.textContent = previous.title; }
    } catch { resumeBtn.hidden = true; }
  }
  const label = (t, on) => {
    buttonText.textContent = on ? "Encerrar" : t === "Gravar com Ata" ? "Gravar" : t;
    btn.classList.toggle("ata-on", !!on);
    icon.className = on ? "ata-meet-stop" : "ata-meet-mic";
    statusText.textContent = on ? "Gravando" : t === "Gravar com Ata" ? "Chamada aberta" : t;
    panel.classList.toggle("ata-recording", !!on);
    reopen.classList.toggle("ata-recording", !!on);
    clock.hidden = !on;
  };
  minimize.addEventListener("click", () => { minimized = true; panel.hidden = true; reopen.hidden = false; });
  reopen.addEventListener("click", () => { minimized = false; panel.hidden = false; reopen.hidden = true; });
  label("Gravar com Ata");
  btn.addEventListener("click", () => { if (!starting && !stopping) void (state.rec ? stop(false) : start()); });

  const callRules = globalThis.AtaMeetCallState;
  const inCall = () => !!document.querySelector(callRules.leaveSelector);
  const callEnded = () => callRules.ended(document.body.innerText);
  const endCapture = () => {
    if (preparing) { preparing.cancelled = true; void globalThis.AtaMeetCapture.halt(preparing); }
    if (state.rec) void stop(true);
  };
  // Observe Meet's own leave action; the Ata panel can remain minimized.
  const leaveAction = (event) => {
    if (event.target instanceof Element && event.target.closest(callRules.leaveSelector)) {
      lastCallSeen = 0;
      endCapture();
    }
  };
  document.addEventListener("click", leaveAction, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") leaveAction(event);
  }, true);
  const title = () => {
    const t = document.title.replace(/^Meet\s*[-–:]\s*/i, "").trim();
    return t && !/^meet$/i.test(t) && !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(t) ? t : "Chamada do Meet";
  };
  // Meet tiles: name + Google profile picture, or a centered snapshot of the live camera.
  const faces = new Map();
  const tileName = (tile) => {
    const el = tile.querySelector("[data-self-name], .notranslate");
    return (el?.textContent || "").trim();
  };
  const snapshot = (video) => {
    if (!video.videoWidth || video.readyState < 2) return null;
    const side = Math.min(video.videoWidth, video.videoHeight) * 0.7;
    const c = document.createElement("canvas"); c.width = c.height = 256;
    c.getContext("2d").drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2.4, side, side, 0, 0, 256, 256);
    try { return c.toDataURL("image/jpeg", 0.82); } catch { return null; }
  };
  const collectFaces = () => {
    document.querySelectorAll("[data-participant-id]").forEach((tile) => {
      const name = tileName(tile);
      if (!name || name.length > 80 || /^(você|you)$/i.test(name)) return;
      const entry = faces.get(name) || { name };
      const img = tile.querySelector('img[src*="googleusercontent.com"]');
      if (img && !entry.photoUrl) entry.photoUrl = img.src.replace(/=s\d+[^/]*$/, "=s256");
      const video = tile.querySelector("video");
      if (video && !entry.photo && !entry.photoUrl) { const shot = snapshot(video); if (shot) entry.photo = shot; }
      faces.set(name, entry);
    });
  };
  const participantNames = () => { collectFaces(); return [...faces.values()].slice(0, 30); };

  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  async function start(resumeMeetingId = null) {
    if (starting || stopping || state.rec) return;
    starting = true; btn.disabled = true; resumeBtn.hidden = true;
    const attempt = { streams: [], ctx: null, cancelled: false };
    preparing = attempt;
    try { await begin(resumeMeetingId, attempt); } finally {
      if (!state.rec) void globalThis.AtaMeetCapture.halt(attempt);
      preparing = null; starting = false; btn.disabled = false; if (!state.rec) void lookup();
    }
  }
  async function begin(resumeMeetingId, attempt) {
    const { token } = await chrome.storage.local.get("token");
    if (attempt.cancelled) return;
    if (!token) { alert("Conecte a extensão ao Ata: clique no ícone do Ata na barra do Chrome e cole o código gerado em Ajustes."); return; }
    label("Escolha esta aba e marque “Compartilhar áudio”…");
    let tab, mic;
    try {
      tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false }, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include" });
    } catch { label("Gravar com Ata"); return; }
    attempt.streams.push(tab);
    if (attempt.cancelled) return;
    if (!tab.getAudioTracks().length) {
      tab.getTracks().forEach((t) => t.stop());
      alert("Sem áudio da chamada. Tente de novo e marque “Compartilhar áudio da guia”.");
      label("Gravar com Ata");
      return;
    }
    tab.getVideoTracks().forEach((t) => t.stop());
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }); } catch { mic = null; }
    if (mic) attempt.streams.push(mic);
    if (attempt.cancelled) return;

    const ctx = new AudioContext();
    attempt.ctx = ctx;
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(new MediaStream(tab.getAudioTracks())).connect(dest);
    if (mic) ctx.createMediaStreamSource(mic).connect(dest);

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    let ids;
    try { ids = await send({ type: "start", body: { title: title(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, codec: mime, meetUrl: location.href, resumeMeetingId, requestId: crypto.randomUUID() } }); }
    catch (e) {
      [tab, mic].forEach((s) => s && s.getTracks().forEach((t) => t.stop())); void ctx.close();
      alert(e.message === "unauthorized" ? "Código inválido. Gere um novo em Ajustes no Ata." : e.message === "capture_active" ? "A reunião anterior ainda está gravando. Aguarde o encerramento para retomar." : e.message === "duration_limit" ? "Esta reunião atingiu o limite de 120 minutos." : e.message === "processing_busy" ? "A reunião está sendo processada. Tente retomar em instantes." : "Não foi possível falar com o Ata. Verifique sua conexão.");
      label("Gravar com Ata");
      return;
    }

    if (attempt.cancelled) {
      // Start may have reached the server while the user left; close that empty session too.
      void send({ type: "finish", params: { recording: ids.recordingId }, meetingId: ids.meetingId, body: { durationMs: 0 } }).catch(() => {});
      return;
    }

    const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 48000 });
    state = { rec, recordingId: ids.recordingId, meetingId: ids.meetingId, seq: 1, startedAt: Date.now(), partStart: 0, streams: [tab, mic].filter(Boolean), ctx, pending: [] };
    const session = state;
    session.remainingMs = ids.remainingMs || 7200000;
    rec.ondataavailable = (ev) => {
      if (!ev.data || !ev.data.size) return;
      const seq = session.seq++, startMs = session.partStart, endMs = Math.min((session.stoppedAt || Date.now()) - session.startedAt, session.remainingMs);
      session.partStart = endMs;
      const p = toB64(ev.data).then((data) => send({ type: "part", params: { recording: session.recordingId, seq: String(seq), start: String(startMs), end: String(endMs) }, data }));
      session.pending.push(p); void p.catch(() => {});
    };
    tab.getAudioTracks()[0].addEventListener("ended", () => void stop(true));
    rec.addEventListener("stop", () => { if (!stopping) void stop(true); });
    rec.addEventListener("error", () => void stop(true));
    session.heartbeat = setInterval(() => {
      if (rec.state === "inactive") { void stop(true); return; }
      void send({ type: "heartbeat", params: { recording: session.recordingId } }).then((r) => { if (!r.active) void stop(true); }).catch(() => {});
    }, 15000);
    faces.clear(); collectFaces();
    rec.start(PART_MS);
    label("● Gravando — parar", true);
    void chrome.storage.local.set({ recording: { title: title(), startedAt: state.startedAt } });
  }

  async function stop(automatic = true) {
    const s = state;
    if (!s.rec || stopping) return;
    stopping = true; btn.disabled = true; resumeBtn.hidden = true; clearInterval(s.heartbeat);
    s.stoppedAt = Date.now();
    state = { ...state, rec: null };
    const stopped = globalThis.AtaMeetCapture.halt(s);
    label("Enviando…");
    void chrome.storage.local.remove("recording");
    await stopped;
    await Promise.allSettled(s.pending);
    try {
      const r = await send({ type: "finish", params: { recording: s.recordingId }, meetingId: s.meetingId, body: { durationMs: Math.min(s.stoppedAt - s.startedAt, s.remainingMs), participants: participantNames() } });
      label("Enviada ao Ata ✓");
      if (!automatic && r && r.meetingId && confirm("Gravação enviada ao Ata. Abrir a reunião?")) void send({ type: "open", meetingId: r.meetingId });
    } catch { label("Falha ao enviar"); }
    stopping = false; btn.disabled = false;
    setTimeout(() => { label("Gravar com Ata"); void lookup(); }, 1500);
  }

  void chrome.storage.local.set({ inCallAt: 0 });
  // Open the in-tab window during a call; leaving the call ends the recording.
  const monitorCall = () => {
    const ended = callEnded();
    const detected = inCall();
    if (ended) endCapture();
    if (detected && !ended) lastCallSeen = Date.now();
    const on = !ended && (detected || (lastCallSeen > 0 && Date.now() - lastCallSeen < 6000));
    void chrome.storage.local.set({ inCallAt: on ? Date.now() : 0 });
    if (on && !panel.isConnected) {
      minimized = false;
      panel.hidden = false;
      reopen.hidden = true;
      document.body.append(panel, reopen);
      void lookup();
    }
    if (state.rec && Date.now() % 10000 < 1500) collectFaces();
    if (state.rec) {
      const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
      if (Date.now() - state.startedAt >= state.remainingMs) void stop(true);
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      if (clock.textContent !== time) clock.textContent = time;
    }
    if (!on && panel.isConnected && !state.rec) { panel.remove(); reopen.remove(); minimized = false; }
    if ((state.rec || preparing) && callRules.shouldEnd({ ended, hasLeaveControl: detected, lastSeen: lastCallSeen, now: Date.now() })) endCapture();
  };
  setInterval(monitorCall, 1500);
  let checkQueued = false;
  new MutationObserver(() => {
    if (checkQueued) return;
    checkQueued = true;
    queueMicrotask(() => { checkQueued = false; monitorCall(); });
  }).observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "hidden"] });
  window.addEventListener("pagehide", endCapture);
  window.addEventListener("beforeunload", endCapture);
})();
