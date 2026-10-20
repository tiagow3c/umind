const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; };
const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res));

async function refresh() {
  const { token } = await chrome.storage.local.get("token");
  if (!token) { status("Não conectado."); return; }
  const r = await send({ type: "check" });
  status(r && r.ok ? "Conectado ao Ata ✓" : "Código inválido ou sem conexão. Cole um novo código.");
}

$("save").addEventListener("click", async () => {
  const token = $("token").value.trim();
  if (!/^ata_[a-f0-9]{48}$/.test(token)) { status("Código inválido."); return; }
  await chrome.storage.local.set({ token });
  $("token").value = "";
  status("Verificando…");
  await refresh();
});

void refresh();
