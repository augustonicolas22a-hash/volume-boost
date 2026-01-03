-- Habilitar pgcrypto corretamente
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Recriar função de hash usando schema correto
CREATE OR REPLACE FUNCTION public.hash_password(p_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(p_password, gen_salt('bf', 10));
$$;

-- Recriar função de verificação
CREATE OR REPLACE FUNCTION public.verify_password(p_password text, p_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p_hash = crypt(p_password, p_hash);
$$;