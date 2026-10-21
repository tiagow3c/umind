const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; };
const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res));
let timer;

function showForm(canCancel) {
  $("connected").hidden = true; $("form").hidden = false; $("cancel").hidden = !canCancel;
  $("token").focus();
}

async function paint() {
  const { recording, inCallAt } = await chrome.storage.local.get(["recording", "inCallAt"]);
  const dot = $("dot");
  if (recording) {
    const s = Math.floor((Date.now() - recording.startedAt) / 1000);
    dot.className = "dot rec";
    $("stTitle").textContent = "Gravando conversa";
    $("stSub").textContent = `${recording.title} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  } else if (inCallAt && Date.now() - inCallAt < 5000) {
    dot.className = "dot pulse";
    $("stTitle").textContent = "Chamada aberta";
    $("stSub").textContent = "Toque em “Gravar com Ata” no topo do Meet.";
  } else {
    dot.className = "dot pulse";
    $("stTitle").textContent = "Monitorando o Meet";
    $("stSub").textContent = "O botão de gravar aparece quando você entrar numa chamada.";
  }
}

async function refresh() {
  const { token } = await chrome.storage.local.get("token");
  if (!token) { showForm(false); status(""); return; }
  $("form").hidden = true; $("connected").hidden = false; status("");
  await paint();
  clearInterval(timer); timer = setInterval(paint, 1000);
  const r = await send({ type: "check" });
  if (!(r && r.ok)) { clearInterval(timer); showForm(false); status("A conexão expirou. Cole um novo código."); }
}

$("reconnect").addEventListener("click", () => { clearInterval(timer); showForm(true); status(""); });
$("cancel").addEventListener("click", () => void refresh());
$("save").addEventListener("click", async () => {
  const token = $("token").value.trim();
  if (!/^ata_[a-f0-9]{48}$/.test(token)) { status("Código inválido."); return; }
  await chrome.storage.local.set({ token });
  $("token").value = "";
  status("Verificando…");
  await refresh();
});

void refresh();
