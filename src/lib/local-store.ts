// IndexedDB store: audio chunks are saved locally before upload so nothing is lost offline.
const DB = "assistente-reunioes";
const STORE = "chunks";

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
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore(STORE, { keyPath: "key" });
      s.createIndex("recordingId", "recordingId");
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
