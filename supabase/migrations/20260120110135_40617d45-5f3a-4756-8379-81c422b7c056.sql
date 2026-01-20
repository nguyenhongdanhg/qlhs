-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'board';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';