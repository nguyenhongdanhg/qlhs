
-- Add expiry_date column to medicines table
ALTER TABLE public.medicines 
ADD COLUMN expiry_date date;

-- Add comment for the column
COMMENT ON COLUMN public.medicines.expiry_date IS 'Expiry date of the medicine';
