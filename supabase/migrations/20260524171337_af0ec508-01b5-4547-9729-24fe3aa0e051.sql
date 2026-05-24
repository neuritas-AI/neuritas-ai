
-- 1. Extend push_preferences with new toggles
ALTER TABLE public.push_preferences
  ADD COLUMN IF NOT EXISTS morning_motivation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_motivation boolean NOT NULL DEFAULT true;

-- 2. Quotes library
CREATE TABLE IF NOT EXISTS public.motivation_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('morning','motivation')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.motivation_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes read all" ON public.motivation_quotes;
CREATE POLICY "quotes read all" ON public.motivation_quotes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quotes admin write" ON public.motivation_quotes;
CREATE POLICY "quotes admin write" ON public.motivation_quotes FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Seed quotes (only if empty)
INSERT INTO public.motivation_quotes (kind, text)
SELECT 'morning', t FROM (VALUES
  ('Goedemorgen 👋 Tijd om er iets sterk van te maken vandaag.'),
  ('Nieuwe dag. Nieuwe kansen 🚀'),
  ('Succes vandaag — focus eerst op wat echt telt.'),
  ('Hopelijk ben je klaar om dingen af te vinken vandaag 💪'),
  ('Goedemorgen. Begin met de moeilijkste taak eerst.'),
  ('Klaar om vandaag iets te bouwen? Laten we gaan.'),
  ('Een nieuwe dag, één duidelijke prioriteit. Wat is die van jou?'),
  ('Goedemorgen ☀️ Klein begin, grote dag.'),
  ('Eerst de belangrijke dingen. Daarna pas de rest.'),
  ('Vandaag is een goeie dag om dingen te doen die morgen-jou bedanken.'),
  ('Goedemorgen. Energie investeren, niet verspillen.'),
  ('Sta op, scherp je focus, en gas erop.'),
  ('De dag is van jou. Maak hem productief.'),
  ('Goedemorgen — kleine acties, dagelijks, winnen alles.'),
  ('Klaar voor een dag zonder excuses?')
) AS v(t)
WHERE NOT EXISTS (SELECT 1 FROM public.motivation_quotes WHERE kind='morning');

INSERT INTO public.motivation_quotes (kind, text)
SELECT 'motivation', t FROM (VALUES
  ('Niet te veel nadenken. Gewoon beginnen.'),
  ('Werk eerst. Scroll later.'),
  ('Consistentie wint van motivatie.'),
  ('1 taak afwerken > 10 taken plannen.'),
  ('Vandaag iets bouwen > vandaag niets doen.'),
  ('Discipline is vrijheid.'),
  ('Doen is de beste vorm van denken.'),
  ('Focus op output, niet op uren.'),
  ('Stop met plannen. Start met uitvoeren.'),
  ('Maak het af. Dan pas verfijnen.'),
  ('De beste tijd was gisteren. De tweede beste is nu.'),
  ('Klein, maar dagelijks. Dat is het hele geheim.'),
  ('Eén ding tegelijk. Goed.'),
  ('Geen excuses. Volgende taak.'),
  ('Vooruit is vooruit, ook traag.'),
  ('Get to work.'),
  ('Niemand komt het voor jou doen.'),
  ('Begin lelijk. Verbeter onderweg.'),
  ('Het werk is het antwoord.'),
  ('Stop met wachten op het perfecte moment.')
) AS v(t)
WHERE NOT EXISTS (SELECT 1 FROM public.motivation_quotes WHERE kind='motivation');

-- 3. Daily schedule table
CREATE TABLE IF NOT EXISTS public.daily_motivation_schedule (
  user_id uuid NOT NULL,
  day date NOT NULL,
  morning_at timestamptz,
  motivation_at timestamptz,
  morning_quote_id uuid,
  motivation_quote_id uuid,
  morning_sent boolean NOT NULL DEFAULT false,
  motivation_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.daily_motivation_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule select own" ON public.daily_motivation_schedule;
CREATE POLICY "schedule select own" ON public.daily_motivation_schedule FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- 4. Generator: builds today's schedule per user with random times + non-repeating quotes
CREATE OR REPLACE FUNCTION public.generate_daily_motivation_schedule()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u RECORD;
  today_brussels date;
  base_morning timestamptz;
  base_motiv timestamptz;
  morning_offset int;
  motiv_offset int;
  m_qid uuid;
  mt_qid uuid;
BEGIN
  today_brussels := (now() AT TIME ZONE 'Europe/Brussels')::date;

  FOR u IN
    SELECT p.id AS user_id,
           COALESCE(pp.push_enabled, true) AS push_enabled,
           COALESCE(pp.morning_motivation, true) AS want_morning,
           COALESCE(pp.daily_motivation, true) AS want_motiv
    FROM public.profiles p
    LEFT JOIN public.push_preferences pp ON pp.user_id = p.id
  LOOP
    IF NOT u.push_enabled THEN CONTINUE; END IF;

    -- Random offsets per user/day
    morning_offset := floor(random() * 3601)::int; -- 0..3600 sec (1 hour window)
    motiv_offset := floor(random() * 32401)::int;  -- 0..32400 sec (9 hour window)

    base_morning := (today_brussels::timestamp + interval '7 hours 30 minutes') AT TIME ZONE 'Europe/Brussels' + (morning_offset || ' seconds')::interval;
    base_motiv := (today_brussels::timestamp + interval '10 hours') AT TIME ZONE 'Europe/Brussels' + (motiv_offset || ' seconds')::interval;

    -- Pick a morning quote not used by this user in last 14 days
    SELECT q.id INTO m_qid
    FROM public.motivation_quotes q
    WHERE q.kind = 'morning'
      AND q.id NOT IN (
        SELECT morning_quote_id FROM public.daily_motivation_schedule
        WHERE user_id = u.user_id AND day > today_brussels - 14 AND morning_quote_id IS NOT NULL
      )
    ORDER BY random() LIMIT 1;
    IF m_qid IS NULL THEN
      SELECT id INTO m_qid FROM public.motivation_quotes WHERE kind='morning' ORDER BY random() LIMIT 1;
    END IF;

    SELECT q.id INTO mt_qid
    FROM public.motivation_quotes q
    WHERE q.kind = 'motivation'
      AND q.id NOT IN (
        SELECT motivation_quote_id FROM public.daily_motivation_schedule
        WHERE user_id = u.user_id AND day > today_brussels - 14 AND motivation_quote_id IS NOT NULL
      )
    ORDER BY random() LIMIT 1;
    IF mt_qid IS NULL THEN
      SELECT id INTO mt_qid FROM public.motivation_quotes WHERE kind='motivation' ORDER BY random() LIMIT 1;
    END IF;

    INSERT INTO public.daily_motivation_schedule (user_id, day, morning_at, motivation_at, morning_quote_id, motivation_quote_id)
    VALUES (
      u.user_id, today_brussels,
      CASE WHEN u.want_morning THEN base_morning ELSE NULL END,
      CASE WHEN u.want_motiv THEN base_motiv ELSE NULL END,
      m_qid, mt_qid
    )
    ON CONFLICT (user_id, day) DO NOTHING;
  END LOOP;
END;
$$;

-- 5. Dispatcher: inserts notifications when scheduled time is reached
CREATE OR REPLACE FUNCTION public.dispatch_motivation_pushes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  q_text text;
BEGIN
  -- Morning
  FOR r IN
    SELECT s.* FROM public.daily_motivation_schedule s
    WHERE s.morning_sent = false
      AND s.morning_at IS NOT NULL
      AND s.morning_at <= now()
      AND s.morning_at > now() - interval '6 hours'
  LOOP
    SELECT text INTO q_text FROM public.motivation_quotes WHERE id = r.morning_quote_id;
    IF q_text IS NULL THEN q_text := 'Goedemorgen 👋'; END IF;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (r.user_id, 'morning_quote', q_text, NULL, '/dashboard');
    UPDATE public.daily_motivation_schedule SET morning_sent = true
      WHERE user_id = r.user_id AND day = r.day;
  END LOOP;

  -- Motivation
  FOR r IN
    SELECT s.* FROM public.daily_motivation_schedule s
    WHERE s.motivation_sent = false
      AND s.motivation_at IS NOT NULL
      AND s.motivation_at <= now()
      AND s.motivation_at > now() - interval '6 hours'
  LOOP
    SELECT text INTO q_text FROM public.motivation_quotes WHERE id = r.motivation_quote_id;
    IF q_text IS NULL THEN q_text := 'Get to work.'; END IF;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (r.user_id, 'motivation_quote', q_text, NULL, '/dashboard');
    UPDATE public.daily_motivation_schedule SET motivation_sent = true
      WHERE user_id = r.user_id AND day = r.day;
  END LOOP;
END;
$$;

-- 6. Cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if exists, then schedule
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'generate-daily-motivation';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'dispatch-motivation';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'generate-daily-motivation',
  '5 0 * * *',
  $$SELECT public.generate_daily_motivation_schedule();$$
);

SELECT cron.schedule(
  'dispatch-motivation',
  '*/5 * * * *',
  $$SELECT public.dispatch_motivation_pushes();$$
);

-- Generate today's schedule immediately so it starts working
SELECT public.generate_daily_motivation_schedule();
