-- Create push_subscriptions table for storing web push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text,
  auth text,
  is_active boolean NOT NULL DEFAULT true,
  reminder_minutes integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();