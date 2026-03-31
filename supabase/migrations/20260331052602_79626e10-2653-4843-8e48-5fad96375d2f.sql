
-- Fix the permissive INSERT policy - only allow system inserts via the trigger (SECURITY DEFINER)
-- Regular users should not insert notifications directly
DROP POLICY "System can insert notifications" ON public.notifications;

-- No INSERT policy needed for authenticated users since the trigger runs as SECURITY DEFINER
-- The trigger function already has the privileges to insert
