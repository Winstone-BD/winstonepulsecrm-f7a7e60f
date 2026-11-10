CREATE TABLE public.sheet_lead_intake_receipts (row_hash text PRIMARY KEY, lead_id uuid REFERENCES public.leads(id), outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.sheet_lead_intake_receipts TO service_role;
ALTER TABLE public.sheet_lead_intake_receipts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.sheet_lead_intake_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slot text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'running', started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, result jsonb);
GRANT ALL ON public.sheet_lead_intake_runs TO service_role;
ALTER TABLE public.sheet_lead_intake_runs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX sheet_lead_intake_one_running ON public.sheet_lead_intake_runs ((status)) WHERE status='running';
CREATE OR REPLACE FUNCTION public.claim_sheet_lead_intake(_slot text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run_id uuid;
BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended('sheet_lead_intake',0));
UPDATE public.sheet_lead_intake_runs SET status='interrupted', finished_at=now() WHERE status='running' AND started_at < now()-interval '15 minutes';
IF EXISTS(SELECT 1 FROM public.sheet_lead_intake_runs WHERE status='running') THEN RETURN NULL; END IF;
IF EXISTS(SELECT 1 FROM public.sheet_lead_intake_runs WHERE slot=_slot AND status='success') THEN RETURN NULL; END IF;
INSERT INTO public.sheet_lead_intake_runs(slot) VALUES(_slot) ON CONFLICT(slot) DO UPDATE SET status='running',started_at=now(),finished_at=NULL,result=NULL RETURNING id INTO run_id;
RETURN run_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_sheet_lead_intake(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sheet_lead_intake(text) TO service_role;