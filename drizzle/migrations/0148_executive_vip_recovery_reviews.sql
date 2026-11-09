CREATE TABLE public.executive_vip_recovery_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cohort_key text NOT NULL,
 lead_id uuid NOT NULL REFERENCES public.leads(id),
 request_id uuid NOT NULL UNIQUE,
 action text NOT NULL CHECK (action IN ('reviewing','resolved','reopened','note')),
 decision text NOT NULL CHECK (decision IN ('needs_evidence','recovery_candidate','unqualified','no_change')),
 note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1500),
 actor_name text NOT NULL,
 actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.executive_vip_recovery_reviews TO service_role;
ALTER TABLE public.executive_vip_recovery_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX executive_vip_recovery_reviews_cohort_lead ON public.executive_vip_recovery_reviews(cohort_key, lead_id, created_at, id);
CREATE TRIGGER executive_vip_recovery_reviews_immutable BEFORE UPDATE OR DELETE ON public.executive_vip_recovery_reviews FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
COMMENT ON TABLE public.executive_vip_recovery_reviews IS 'Server-authorized management reviews only; derived audit tasks do not change lead ownership, qualification, follow-ups or KPI scoring.';