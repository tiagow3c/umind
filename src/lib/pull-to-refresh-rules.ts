/** Regras puras do gesto "puxar para atualizar" no celular. */

/** Amortecimento: a barra desce metade do caminho do dedo. */
export const PULL_DAMPING = 0.5;

/** Deslocamento máximo da barra, por mais que o dedo desça. */
export const PULL_MAX_OFFSET = 110;

/** A partir daqui, soltar o dedo atualiza a página. */
export const PULL_THRESHOLD = 56;

/** A barra fica visível por pelo menos esse tempo enquanto atualiza. */
export const MIN_REFRESH_MS = 700;

/** Quanto a barra desce (em px) para um deslocamento de dedo de `travelPx`. */
export function pullOffset(travelPx: number): number {
  if (!Number.isFinite(travelPx) || travelPx <= 0) return 0;
  return Math.min(PULL_MAX_OFFSET, travelPx * PULL_DAMPING);
}

/** O puxão já chegou ao ponto em que soltar vai atualizar a página. */
export function pullReady(offsetPx: number): boolean {
  return offsetPx >= PULL_THRESHOLD;
}

/** A barra surge aos poucos conforme o dedo desce. */
export function pullOpacity(offsetPx: number): number {
  if (!Number.isFinite(offsetPx) || offsetPx <= 0) return 0;
  return Math.min(1, offsetPx / PULL_THRESHOLD);
}
