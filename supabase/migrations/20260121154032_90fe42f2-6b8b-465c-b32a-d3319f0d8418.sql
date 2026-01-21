-- Add birth_date column to profiles table for age-based duty assignment
ALTER TABLE public.profiles 
ADD COLUMN birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS 'User birth date for age-based duty assignment sorting';