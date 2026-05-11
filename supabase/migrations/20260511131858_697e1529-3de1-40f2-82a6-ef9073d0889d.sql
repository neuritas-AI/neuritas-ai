CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat select" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat delete" ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE INDEX chat_messages_created_at_idx ON public.chat_messages (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;