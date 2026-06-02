-- Track that the "to send" reminder has been dispatched for an invoice
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS send_reminder_sent boolean NOT NULL DEFAULT false;

-- Reset the reminder flag if the issue date changes or status returns to 'to_send'
CREATE OR REPLACE FUNCTION public.reset_invoice_reminder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.issue_date IS DISTINCT FROM OLD.issue_date) THEN
    NEW.send_reminder_sent := false;
  ELSIF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text = 'to_send') THEN
    NEW.send_reminder_sent := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reset_invoice_reminder_trg ON public.invoices;
CREATE TRIGGER reset_invoice_reminder_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.reset_invoice_reminder();

-- Dispatcher: for every 'to_send' invoice whose issue_date is tomorrow (Brussels),
-- create a single notification for the responsible user (created_by) or all admins
CREATE OR REPLACE FUNCTION public.dispatch_invoice_send_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid uuid;
  recipients uuid[];
  tomorrow_brussels date;
BEGIN
  tomorrow_brussels := ((now() AT TIME ZONE 'Europe/Brussels')::date) + 1;

  FOR inv IN
    SELECT * FROM public.invoices
    WHERE status::text = 'to_send'
      AND send_reminder_sent = false
      AND issue_date = tomorrow_brussels
  LOOP
    IF inv.created_by IS NOT NULL THEN
      recipients := ARRAY[inv.created_by];
    ELSE
      SELECT COALESCE(array_agg(user_id), '{}'::uuid[]) INTO recipients
      FROM public.user_roles WHERE role = 'admin';
    END IF;

    IF recipients IS NOT NULL THEN
      FOREACH uid IN ARRAY recipients LOOP
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (
          uid,
          'invoice_reminder',
          'Vergeet niet factuur ' || inv.number || ' morgen te verzenden',
          'Status staat nog op ''Te verzenden''.',
          '/billing'
        );
      END LOOP;
    END IF;

    UPDATE public.invoices SET send_reminder_sent = true WHERE id = inv.id;
  END LOOP;
END $$;

-- Daily schedule at 08:00 UTC (~09:00/10:00 Brussels depending on DST)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-invoice-send-reminders') THEN
    PERFORM cron.unschedule('dispatch-invoice-send-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'dispatch-invoice-send-reminders',
  '0 8 * * *',
  'SELECT public.dispatch_invoice_send_reminders();'
);