// Stop physical capture synchronously; only final audio delivery remains asynchronous.
globalThis.AtaMeetCapture = {
  halt(session) {
    const rec = session.rec;
    const stopped = !rec || rec.state === "inactive" ? Promise.resolve() : new Promise((resolve) => {
      rec.addEventListener("stop", resolve, { once: true });
      try { rec.stop(); } catch { resolve(); }
    });
    const tracks = new Set([...(session.streams || []).flatMap((stream) => stream.getTracks()), ...(rec?.stream?.getTracks() || [])]);
    for (const track of tracks) { try { track.stop(); } catch {} }
    if (session.ctx && session.ctx.state !== "closed") {
      try { void session.ctx.close().catch(() => {}); } catch {}
    }
    return stopped;
  },
};