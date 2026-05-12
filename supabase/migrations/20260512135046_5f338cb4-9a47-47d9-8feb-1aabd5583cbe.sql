DROP INDEX IF EXISTS public.idx_notif_dedup;
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON public.notifications (user_id, created_at DESC);