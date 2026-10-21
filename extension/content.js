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
  let minimized = false, starting = false, stopping = false, previous = null, lastCallSeen = 0;
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

  const inCall = () => !!document.querySelector('[aria-label*="Sair da chamada" i], [aria-label*="Leave call" i], [aria-label*="Sair da reunião" i]');
  const title = () => {
    const t = document.title.replace(/^Meet\s*[-–:]\s*/i, "").trim();
    return t && !/^meet$/i.test(t) && !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(t) ? t : "Chamada do Meet";
  };
  const participantNames = () => {
    const names = new Set();
    document.querySelectorAll("[data-participant-id] [data-self-name], [data-participant-id] .notranslate").forEach((el) => {
      const n = (el.textContent || "").trim();
      if (n && n.length < 80 && !/^(você|you)$/i.test(n)) names.add(n);
    });
    return [...names];
  };

  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  async function start(resumeMeetingId = null) {
    if (starting || stopping || state.rec) return;
    starting = true; btn.disabled = true; resumeBtn.hidden = true;
    try { await begin(resumeMeetingId); } finally { starting = false; btn.disabled = false; if (!state.rec) void lookup(); }
  }
  async function begin(resumeMeetingId) {
    const { token } = await chrome.storage.local.get("token");
    if (!token) { alert("Conecte a extensão ao Ata: clique no ícone do Ata na barra do Chrome e cole o código gerado em Ajustes."); return; }
    label("Escolha esta aba e marque “Compartilhar áudio”…");
    let tab, mic;
    try {
      tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false }, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include" });
    } catch { label("Gravar com Ata"); return; }
    if (!tab.getAudioTracks().length) {
      tab.getTracks().forEach((t) => t.stop());
      alert("Sem áudio da chamada. Tente de novo e marque “Compartilhar áudio da guia”.");
      label("Gravar com Ata");
      return;
    }
    tab.getVideoTracks().forEach((t) => t.stop());
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }); } catch { mic = null; }

    const ctx = new AudioContext();
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

    const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 48000 });
    state = { rec, recordingId: ids.recordingId, meetingId: ids.meetingId, seq: 1, startedAt: Date.now(), partStart: 0, streams: [tab, mic].filter(Boolean), ctx, pending: [] };
    const session = state;
    session.remainingMs = ids.remainingMs || 7200000;
    rec.ondataavailable = (ev) => {
      if (!ev.data || !ev.data.size) return;
      const seq = session.seq++, startMs = session.partStart, endMs = Math.min(Date.now() - session.startedAt, session.remainingMs);
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
    rec.start(PART_MS);
    label("● Gravando — parar", true);
    void chrome.storage.local.set({ recording: { title: title(), startedAt: state.startedAt } });
  }

  async function stop(automatic = true) {
    const s = state;
    if (!s.rec || stopping) return;
    stopping = true; btn.disabled = true; resumeBtn.hidden = true; clearInterval(s.heartbeat);
    state = { ...state, rec: null };
    label("Enviando…");
    void chrome.storage.local.remove("recording");
    if (s.rec.state !== "inactive") await new Promise((r) => { s.rec.addEventListener("stop", r, { once: true }); try { s.rec.stop(); } catch { r(); } });
    s.streams.forEach((st) => st.getTracks().forEach((t) => t.stop()));
    void s.ctx.close();
    await Promise.allSettled(s.pending);
    try {
      const r = await send({ type: "finish", params: { recording: s.recordingId }, meetingId: s.meetingId, body: { durationMs: Math.min(Date.now() - s.startedAt, s.remainingMs), participants: participantNames() } });
      label("Enviada ao Ata ✓");
      if (!automatic && r && r.meetingId && confirm("Gravação enviada ao Ata. Abrir a reunião?")) void send({ type: "open", meetingId: r.meetingId });
    } catch { label("Falha ao enviar"); }
    stopping = false; btn.disabled = false;
    setTimeout(() => { label("Gravar com Ata"); void lookup(); }, 1500);
  }

  void chrome.storage.local.set({ inCallAt: 0 });
  // Open the in-tab window during a call; leaving the call ends the recording.
  setInterval(() => {
    const detected = inCall();
    if (detected) lastCallSeen = Date.now();
    const on = detected || (Date.now() - lastCallSeen < 6000);
    void chrome.storage.local.set({ inCallAt: on ? Date.now() : 0 });
    if (on && !panel.isConnected) {
      minimized = false;
      panel.hidden = false;
      reopen.hidden = true;
      document.body.append(panel, reopen);
      void lookup();
    }
    if (state.rec) {
      const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
      if (Date.now() - state.startedAt >= state.remainingMs) void stop(true);
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }
    if (!on && panel.isConnected && !state.rec) { panel.remove(); reopen.remove(); minimized = false; }
    if (!on && state.rec) void stop(true);
  }, 1500);
  window.addEventListener("beforeunload", () => { if (state.rec) void stop(); });
})();
