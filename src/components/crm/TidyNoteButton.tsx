import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tidyAiReportNote } from "@/lib/ai-features.functions";
import { useAdminToken } from "@/lib/local-session";
import { useLang, useT } from "@/lib/i18n";

type AiLang = "bn" | "en";
const AI_LANG_KEY = "winstone.aiSuggestionLang";

/** Saved Bangla/English choice for AI suggestions; falls back to the UI language. */
export function useAiSuggestionLang(): [AiLang, (l: AiLang) => void] {
  const uiLang = useLang();
  const [lang, setLang] = useState<AiLang>(uiLang === "en" ? "en" : "bn");
  useEffect(() => {
    const saved = window.localStorage.getItem(AI_LANG_KEY);
    if (saved === "bn" || saved === "en") setLang(saved);
  }, []);
  const update = (l: AiLang) => {
    setLang(l);
    window.localStorage.setItem(AI_LANG_KEY, l);
  };
  return [lang, update];
}

/**
 * Call report assistant: Winstone AI suggests a tidier note. The agent sees
 * the original and the suggestion side by side and chooses to apply or keep
 * the original. Nothing changes until "Apply" is pressed.
 */
export function TidyNoteButton({ text, onTidy }: { text: string; onTidy: (note: string) => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const tidy = useServerFn(tidyAiReportNote);
  const [aiLang, setAiLang] = useAiSuggestionLang();
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null);

  const run = useMutation({
    mutationFn: (source: string) => tidy({ data: { adminToken, text: source, lang: aiLang } }),
    onSuccess: (r, source) => setPreview({ before: source, after: r.note }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const apply = () => {
    if (!preview) return;
    onTidy(preview.after);
    setPreview(null);
    toast.success(t({ bn: "নোট বদলানো হয়েছে — জমা দেওয়ার আগে দেখে নিন", en: "Note updated — check it before submitting" }));
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <div role="group" aria-label={t({ bn: "AI ভাষা", en: "AI language" })}
          className="flex overflow-hidden rounded-md border border-border text-xs">
          {(["bn", "en"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={aiLang === l} onClick={() => setAiLang(l)}
              className={`px-2 py-1 ${aiLang === l ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
              {l === "bn" ? "বাংলা" : "English"}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
          disabled={run.isPending || text.trim().length < 5} onClick={() => run.mutate(text)}>
          {run.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {t({ bn: "AI দিয়ে সাজান", en: "Tidy with AI" })}
        </Button>
      </div>

      {preview && (
        <div className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t({ bn: "আগে (আপনার নোট)", en: "Before (your note)" })}</p>
              <p className="whitespace-pre-wrap rounded bg-muted p-2 text-muted-foreground">{preview.before}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-foreground">{t({ bn: "পরে (AI প্রস্তাব)", en: "After (AI suggestion)" })}</p>
              <p className="whitespace-pre-wrap rounded border border-primary/40 bg-background p-2">{preview.after}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPreview(null)}>
              <X className="size-3.5" />{t({ bn: "আগেরটাই রাখুন", en: "Keep original" })}
            </Button>
            <Button type="button" size="sm" onClick={apply}>
              <Check className="size-3.5" />{t({ bn: "প্রয়োগ করুন", en: "Apply" })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
