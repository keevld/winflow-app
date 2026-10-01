-- Winflow Phase 1: reliable proposal lifecycle, audit trail, and private PDFs.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sending_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS generation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_subject text;

-- "viewed" is an event (opened_at), not a lifecycle state. Preserve the open timestamp.
UPDATE public.proposals SET status = 'sent' WHERE status = 'viewed';

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.proposals'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.proposals DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft', 'generating', 'ready', 'sending', 'sent', 'failed'));

CREATE TABLE IF NOT EXISTS public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal events in own agency" ON public.proposal_events
  FOR SELECT TO authenticated
  USING (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS proposal_events_proposal_created_idx
  ON public.proposal_events(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS proposals_client_status_created_idx
  ON public.proposals(client_id, status, created_at DESC);

-- Private by design: only the server/service role creates signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposals', 'proposals', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
