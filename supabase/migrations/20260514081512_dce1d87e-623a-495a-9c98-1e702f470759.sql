REVOKE EXECUTE ON FUNCTION public.dispatch_reminders() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, authenticated, anon;