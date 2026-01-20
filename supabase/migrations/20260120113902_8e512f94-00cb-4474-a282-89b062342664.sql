-- Create rice inventory table to track rice input
CREATE TABLE public.rice_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rice_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for rice_inventory (using correct parameter order: uid, sid, role)
CREATE POLICY "School members can view rice inventory"
ON public.rice_inventory
FOR SELECT
USING (
  is_school_member(auth.uid(), school_id)
);

CREATE POLICY "Admins and accountants can insert rice inventory"
ON public.rice_inventory
FOR INSERT
WITH CHECK (
  is_school_admin(auth.uid(), school_id) OR
  has_role_in_school(auth.uid(), school_id, 'accountant'::app_role) OR
  is_super_admin(auth.uid())
);

CREATE POLICY "Admins and accountants can update rice inventory"
ON public.rice_inventory
FOR UPDATE
USING (
  is_school_admin(auth.uid(), school_id) OR
  has_role_in_school(auth.uid(), school_id, 'accountant'::app_role) OR
  is_super_admin(auth.uid())
);

CREATE POLICY "Admins and accountants can delete rice inventory"
ON public.rice_inventory
FOR DELETE
USING (
  is_school_admin(auth.uid(), school_id) OR
  has_role_in_school(auth.uid(), school_id, 'accountant'::app_role) OR
  is_super_admin(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_rice_inventory_updated_at
BEFORE UPDATE ON public.rice_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_rice_inventory_school_id ON public.rice_inventory(school_id);
CREATE INDEX idx_rice_inventory_created_at ON public.rice_inventory(created_at DESC);