/**
 * Theme switch: light, dark, or follow the system.
 *
 * The `.dark` class on <html> drives every token in src/styles.css. Because the
 * choice is also applied by an inline script before first paint (THEME_BOOTSTRAP
 * below, rendered in src/routes/__root.tsx), the page never flashes the wrong
 * theme — so this module only has to keep things in sync after that.
 *
 * Both sides read the same key ("ata-theme") and the same system preference.
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "ata-theme";
const EVENT = "ata-theme-change";
const LIGHT_BAR = "#f7f4ed";
const DARK_BAR = "#1b1b1b";

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readChoice(): ThemeChoice {
  const v = store()?.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function isDark(choice: ThemeChoice = readChoice()): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

/** Paint the current choice onto the document and tell every subscriber. */
export function applyChoice(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const dark = isDark(choice);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute("content", dark ? DARK_BAR : LIGHT_BAR);
  window.dispatchEvent(new Event(EVENT));
}

export function setChoice(choice: ThemeChoice) {
  store()?.setItem(KEY, choice);
  applyChoice(choice);
}

/** Subscribe to both explicit changes and the system switch while on "system". */
export function subscribeTheme(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readChoice() === "system") applyChoice("system");
    else fn();
  };
  window.addEventListener(EVENT, fn);
  mq?.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, fn);
    mq?.removeEventListener("change", onSystem);
  };
}

/**
 * Runs before the browser paints. Kept as a string because an inline script
 * cannot import this module; it must mirror readChoice/isDark/applyChoice.
 */
export const THEME_BOOTSTRAP = `(function(){try{var k="ata-theme";var c=localStorage.getItem(k);if(c!=="light"&&c!=="dark")c="system";var d=c==="dark"||(c==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",!!d);e.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${DARK_BAR}":"${LIGHT_BAR}");}catch(x){}})();`;
