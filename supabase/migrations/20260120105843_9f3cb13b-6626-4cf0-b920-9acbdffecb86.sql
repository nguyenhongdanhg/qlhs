-- Add position/title field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS position TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.position IS 'Chức vụ của người dùng (VD: Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng...)';