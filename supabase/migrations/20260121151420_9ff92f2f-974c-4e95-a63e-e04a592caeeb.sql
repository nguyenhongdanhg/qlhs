-- Add gender column to profiles table for duty scheduling rules
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text;

-- Add comment explaining the field usage
COMMENT ON COLUMN public.profiles.gender IS 'Gender of user: male, female, or other - used for duty scheduling rules';