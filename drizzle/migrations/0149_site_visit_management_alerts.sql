-- Additive only: no backfill, no changes to customer/report/visit rows.
ALTER TABLE public.system_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS system_alerts_site_visit_open_report_idx
  ON public.system_alerts(code) WHERE code LIKE 'site_visit_unbooked:%' AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.reconcile_site_visit_alert(_report uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.call_reports%ROWTYPE; lead_name text; agent_name text; alert_code text;
BEGIN
  SELECT * INTO r FROM public.call_reports WHERE id = _report;
  IF NOT FOUND OR r.lead_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('visit_alert:' || r.lead_id::text, 0));
  alert_code := 'site_visit_unbooked:' || r.id::text;
  IF r.status <> 'submitted' OR r.submitted_at IS NULL
    OR NOT (coalesce(r.customer_response, '') = 'site_visit' OR coalesce(r.next_action, '') = 'site_visit')
    OR EXISTS (SELECT 1 FROM public.site_visits v WHERE v.lead_id = r.lead_id
      AND v.status IN ('scheduled', 'completed') AND v.visit_at >= r.submitted_at) THEN
    UPDATE public.system_alerts SET resolved_at = now()
      WHERE code = alert_code AND resolved_at IS NULL;
    RETURN;
  END IF;
  SELECT l.name, p.name INTO lead_name, agent_name FROM public.leads l
    LEFT JOIN public.profiles p ON p.id = coalesce(l.assigned_agent_id, l.assigned_to)
    WHERE l.id = r.lead_id;
  INSERT INTO public.system_alerts(code, severity, title, detail, action)
    VALUES (alert_code, 'warning', 'Site visit reported — no scheduled visit',
      coalesce(lead_name, 'Lead') || ' · ' || coalesce(agent_name, 'Unassigned') ||
      ' · Report ' || r.id::text || ' · Saved visit interest/action; no matching scheduled or completed visit.',
      '/site-visits')
    ON CONFLICT (code) WHERE code LIKE 'site_visit_unbooked:%' AND resolved_at IS NULL DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_site_visit_alert(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_site_visit_alert(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.site_visit_report_alert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reconcile_site_visit_alert(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.site_visit_report_alert_trigger() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER site_visit_report_alert AFTER INSERT OR UPDATE OF status, submitted_at, customer_response, next_action
  ON public.call_reports FOR EACH ROW EXECUTE FUNCTION public.site_visit_report_alert_trigger();

CREATE OR REPLACE FUNCTION public.site_visit_booking_alert_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE report_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('visit_alert:' || NEW.lead_id::text, 0));
  FOR report_id IN SELECT id FROM public.call_reports WHERE lead_id = NEW.lead_id AND status = 'submitted'
    AND submitted_at IS NOT NULL AND (customer_response = 'site_visit' OR next_action = 'site_visit') LOOP
    PERFORM public.reconcile_site_visit_alert(report_id);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.site_visit_booking_alert_trigger() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER site_visit_booking_alert AFTER INSERT OR UPDATE OF status, visit_at
  ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.site_visit_booking_alert_trigger();