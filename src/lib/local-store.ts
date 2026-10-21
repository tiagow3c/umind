// IndexedDB store: audio chunks are saved locally before upload so nothing is lost offline.
const DB = "assistente-reunioes";
const STORE = "chunks";
const SESSIONS = "sessions";
export type LocalCapture = { recordingId: string; meetingId: string; workspaceId: string; userId: string; durationMs: number };
const activeCaptures = new Set<string>();
export function markCaptureActive(id: string, active: boolean) { if (active) activeCaptures.add(id); else activeCaptures.delete(id); }
export function isCaptureActive(id: string) { return activeCaptures.has(id); }

export type LocalChunk = {
  key: string; // recordingId:sequence
  recordingId: string;
  sequence: number;
  blob: Blob;
  startMs: number;
  endMs: number;
  uploaded: boolean;
};

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) {
        const s = r.result.createObjectStore(STORE, { keyPath: "key" });
        s.createIndex("recordingId", "recordingId");
      }
      if (!r.result.objectStoreNames.contains(SESSIONS)) r.result.createObjectStore(SESSIONS, { keyPath: "recordingId" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function putChunk(c: LocalChunk) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(c);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function listChunks(recordingId: string): Promise<LocalChunk[]> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).index("recordingId").getAll(recordingId);
    r.onsuccess = () => res((r.result as LocalChunk[]).sort((a, b) => a.sequence - b.sequence));
    r.onerror = () => rej(r.error);
  });
}

export async function sha256Hex(data: Blob | string) {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : await data.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveCapture(session: LocalCapture) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSIONS, "readwrite"); tx.objectStore(SESSIONS).put(session);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function removeCapture(id: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSIONS, "readwrite"); tx.objectStore(SESSIONS).delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function listCaptures(): Promise<LocalCapture[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(SESSIONS).objectStore(SESSIONS).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as LocalCapture[]); }; req.onerror = () => reject(req.error);
  });
}
