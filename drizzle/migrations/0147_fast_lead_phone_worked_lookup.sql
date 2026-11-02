-- Forward: indexed replacement for the full-scan in lead_phone_was_ever_worked.
-- Rollback: re-run the previous function body from 0039 (CREATE OR REPLACE); the alias table can stay (unused).
-- Additive only: new server-only table, backfilled from existing leads; no existing rows changed.

CREATE TABLE IF NOT EXISTS public.lead_phone_legacy_aliases (
  canonical_phone text NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canonical_phone, lead_id)
);
COMMENT ON TABLE public.lead_phone_legacy_aliases IS 'Frozen snapshot of lead phones not covered by lead_phone_keys (legacy rows predating the claim trigger). Server-only; used for fast already-worked lookups.';

GRANT ALL ON public.lead_phone_legacy_aliases TO service_role;
ALTER TABLE public.lead_phone_legacy_aliases ENABLE ROW LEVEL SECURITY;

INSERT INTO public.lead_phone_legacy_aliases (canonical_phone, lead_id)
SELECT DISTINCT p.phone, l.id
FROM public.leads l
CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(phone)
WHERE l.phone_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_phone_keys k
    WHERE k.canonical_phone = p.phone AND k.lead_id = l.id
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.lead_phone_was_ever_worked(_raw text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH incoming AS (
    SELECT phone FROM public.extract_bd_phones(_raw) p(phone)
  ), candidates AS (
    SELECT k.lead_id FROM public.lead_phone_keys k JOIN incoming i ON i.phone = k.canonical_phone
    UNION
    SELECT a.lead_id FROM public.lead_phone_legacy_aliases a JOIN incoming i ON i.phone = a.canonical_phone
  )
  SELECT EXISTS (
    SELECT 1 FROM candidates c WHERE public.lead_has_work_history(c.lead_id)
  )
$function$;