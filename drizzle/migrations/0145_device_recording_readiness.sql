-- Additive only: four nullable columns reported by the phone app. No defaults, no backfill.
ALTER TABLE public.agent_devices
  ADD COLUMN IF NOT EXISTS recording_consent text,
  ADD COLUMN IF NOT EXISTS recording_consent_version integer,
  ADD COLUMN IF NOT EXISTS mic_permission text,
  ADD COLUMN IF NOT EXISTS readiness_reported_at timestamptz;

ALTER TABLE public.agent_devices DROP CONSTRAINT IF EXISTS agent_devices_recording_consent_check;
ALTER TABLE public.agent_devices ADD CONSTRAINT agent_devices_recording_consent_check
  CHECK (recording_consent IS NULL OR recording_consent IN ('granted', 'declined', 'not_asked'));
ALTER TABLE public.agent_devices DROP CONSTRAINT IF EXISTS agent_devices_mic_permission_check;
ALTER TABLE public.agent_devices ADD CONSTRAINT agent_devices_mic_permission_check
  CHECK (mic_permission IS NULL OR mic_permission IN ('granted', 'denied'));

COMMENT ON COLUMN public.agent_devices.recording_consent IS
  'Phone-reported recording consent for the signed-in agent and current consent version. NULL = app too old to report.';
COMMENT ON COLUMN public.agent_devices.mic_permission IS
  'Phone-reported Android RECORD_AUDIO permission. NULL = not reported.';
COMMENT ON COLUMN public.agent_devices.readiness_reported_at IS
  'When the phone last reported consent and microphone state.';