import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tidyAiReportNote } from "@/lib/ai-features.functions";
import { useAdminToken } from "@/lib/local-session";
import { useLang, useT } from "@/lib/i18n";

/**
 * Call report assistant: Winstone AI rewrites the agent's rough note into a
 * clean short note in the same box. Only the note text changes; the agent
 * reviews it and still submits the report themselves.
 */
export function TidyNoteButton({ text, onTidy }: { text: string; onTidy: (note: string) => void }) {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const tidy = useServerFn(tidyAiReportNote);
  const run = useMutation({
    mutationFn: () => tidy({ data: { adminToken, text, lang } }),
    onSuccess: (r) => {
      onTidy(r.note);
      toast.success(t({ bn: "নোট সাজানো হয়েছে — জমা দেওয়ার আগে দেখে নিন", en: "Note tidied — check it before submitting" }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
      disabled={run.isPending || text.trim().length < 5} onClick={() => run.mutate()}>
      {run.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
      {t({ bn: "AI দিয়ে সাজান", en: "Tidy with AI" })}
    </Button>
  );
}
