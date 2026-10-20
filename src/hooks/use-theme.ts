import { useCallback, useEffect, useState } from "react";
import { applyChoice, isDark, readChoice, setChoice, subscribeTheme, type ThemeChoice } from "@/lib/theme";

/**
 * The theme choice for this client. It starts on "system" and settles to the
 * stored value in an effect, so server render and the first client render agree
 * (the pre-paint script already put the right class on <html>, so nothing moves).
 */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => {
      setChoiceState(readChoice());
      setDark(isDark());
    };
    sync();
    return subscribeTheme(sync);
  }, []);

  const change = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    setDark(isDark(next));
    setChoice(next);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeChoice = isDark() ? "light" : "dark";
    setChoiceState(next);
    setDark(isDark(next));
    setChoice(next);
  }, []);

  return { choice, dark, change, toggle, apply: applyChoice };
}
