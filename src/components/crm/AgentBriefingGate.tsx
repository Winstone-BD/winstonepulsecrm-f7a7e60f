import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { acknowledgeMyBriefing, getMyBriefingStatus } from "@/lib/agent-briefing.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export function AgentBriefingGate() {
  const adminToken = useAdminToken();
  const t = useT();
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getMyBriefingStatus);
  const acknowledge = useServerFn(acknowledgeMyBriefing);
  const status = useQuery({
    queryKey: ["agent-briefing-status"],
    queryFn: () => getStatus({ data: { adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const ack = useMutation({
    mutationFn: () => acknowledge({ data: { adminToken } }),
    onSuccess: (next) => {
      queryClient.setQueryData(["agent-briefing-status"], next);
      toast.success(t({ bn: "আজকের ব্রিফিং স্বীকার করা হয়েছে", en: "Today's briefing acknowledged" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const blocked = Boolean(status.data?.required && !status.data.acknowledged);
  const hold = status.data && "hold" in status.data ? status.data.hold : null;

  if (hold) {
    return (
      <AlertDialog open>
        <AlertDialogContent className="max-w-md" onEscapeKeyDown={(event) => event.preventDefault()}>
          <AlertDialogHeader>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <Lock className="size-6" />
            </span>
            <AlertDialogTitle>{t({ bn: "অ্যাকাউন্ট সাময়িকভাবে স্থগিত", en: "Account temporarily on hold" })}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-foreground">
              {t({
                bn: "Executive HQ বরাবর যোগাযোগ করুন। HQ থেকে অনুমোদন দিলে অথবা সকাল ১১:১৫ বাজলে অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে আনলক হবে।",
                en: "Please contact Executive HQ. Your account unlocks automatically when HQ approves or at 11:15 AM Dhaka.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="mb-1 font-medium">{t({ bn: "কেন স্থগিত", en: "Why on hold" })}</p>
            <p className="leading-6 text-muted-foreground">{t({ bn: hold.reasonBn ?? "", en: hold.reasonEn ?? "" })}</p>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={blocked}>
      <AlertDialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <ShieldCheck className="size-6" />
          </span>
          <AlertDialogTitle>{status.data ? t({ bn: status.data.title, en: status.data.titleEn }) : null}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-foreground">
            {status.data ? t({ bn: status.data.detail, en: status.data.detailEn }) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t({ bn: "এই নোটিশ স্বীকার না করা পর্যন্ত কোনো কল শুরু হবে না।", en: "No call can start until you acknowledge this notice." })}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction disabled={ack.isPending} onClick={() => ack.mutate()}>
            {ack.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {t({ bn: "বুঝেছি — কল শুরু করব", en: "Got it — start calling" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}