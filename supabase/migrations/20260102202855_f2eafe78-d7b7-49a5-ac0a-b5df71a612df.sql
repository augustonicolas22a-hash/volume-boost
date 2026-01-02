-- Add PIN column to admins table
ALTER TABLE public.admins ADD COLUMN pin TEXT DEFAULT NULL;

-- Create function to validate PIN
CREATE OR REPLACE FUNCTION public.validate_pin(p_admin_id INTEGER, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE id = p_admin_id AND pin = p_pin
  );
END;
$$;

-- Create function to set PIN
CREATE OR REPLACE FUNCTION public.set_admin_pin(p_admin_id INTEGER, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admins SET pin = p_pin WHERE id = p_admin_id;
  RETURN TRUE;
END;
$$;