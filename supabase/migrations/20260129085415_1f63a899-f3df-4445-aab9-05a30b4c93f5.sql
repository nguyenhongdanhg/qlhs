-- Add notes column to emulation_scores table
ALTER TABLE public.emulation_scores 
ADD COLUMN notes text;