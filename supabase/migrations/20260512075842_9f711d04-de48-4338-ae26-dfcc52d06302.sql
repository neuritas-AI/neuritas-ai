ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'client_meeting';

-- Backfill existing rows: keep their existing color but set a sensible type
UPDATE public.appointments SET appointment_type = 'client_meeting' WHERE appointment_type IS NULL;

-- Add a check constraint for the 4 known types
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_type_check
    CHECK (appointment_type IN ('client_meeting','internal','deadline','followup'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;