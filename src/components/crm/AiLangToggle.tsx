import { useEffect, useState } from "react";
import { useLang, useT } from "@/lib/i18n";

export type AiLang = "bn" | "en";
const AI_LANG_KEY = "winstone.aiSuggestionLang";
const EVENT = "winstone:ai-lang";

/**
 * One saved Bangla/English choice for every Winstone AI (Gemini) suggestion.
 * Defaults to the app language until the user picks; all toggles stay in sync.
 */
export function useAiSuggestionLang(): [AiLang, (l: AiLang) => void] {
  const uiLang = useLang();
  const [saved, setSaved] = useState<AiLang | null>(null);
  useEffect(() => {
    const read = () => {
      const v = window.localStorage.getItem(AI_LANG_KEY);
      setSaved(v === "bn" || v === "en" ? v : null);
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const update = (l: AiLang) => {
    window.localStorage.setItem(AI_LANG_KEY, l);
    window.dispatchEvent(new Event(EVENT));
  };
  return [saved ?? (uiLang === "en" ? "en" : "bn"), update];
}

export function AiLangToggle() {
  const t = useT();
  const [lang, setLang] = useAiSuggestionLang();
  return (
    <div role="group" aria-label={t({ bn: "AI উত্তরের ভাষা", en: "AI answer language" })}
      className="flex overflow-hidden rounded-md border border-border text-xs">
      {(["bn", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`px-2 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
          {l === "bn" ? "বাংলা" : "English"}
        </button>
      ))}
    </div>
  );
}
