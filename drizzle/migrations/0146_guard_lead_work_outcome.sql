-- Additive guard: lead outcome/completion fields may only be changed by the
-- server-side report finalizers (service role, no end-user JWT). Signed-in
-- users writing directly through the Data API can no longer mark leads
-- completed or classified. No rows are modified.
CREATE OR REPLACE FUNCTION public.guard_lead_work_outcome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.work_state, 'pending') <> 'pending'
       OR NEW.temperature IS NOT NULL
       OR NEW.grade IS NOT NULL
       OR NEW.classified_at IS NOT NULL
       OR NEW.classified_by IS NOT NULL THEN
      RAISE EXCEPTION 'Lead outcomes can only be recorded through a submitted call report';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.work_state IS DISTINCT FROM OLD.work_state
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.outcome_category IS DISTINCT FROM OLD.outcome_category
     OR NEW.temperature IS DISTINCT FROM OLD.temperature
     OR NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.classified_at IS DISTINCT FROM OLD.classified_at
     OR NEW.classified_by IS DISTINCT FROM OLD.classified_by THEN
    RAISE EXCEPTION 'Lead outcomes can only be recorded through a submitted call report';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_guard_work_outcome ON public.leads;
CREATE TRIGGER leads_guard_work_outcome
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.guard_lead_work_outcome();

-- Rollback (if ever needed): DROP TRIGGER leads_guard_work_outcome ON public.leads;
