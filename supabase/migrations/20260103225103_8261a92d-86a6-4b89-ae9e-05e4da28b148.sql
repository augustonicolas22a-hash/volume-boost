-- =============================================
-- SEGURANÇA: Implementar hash de senhas
-- =============================================

-- Habilitar extensão pgcrypto para bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para fazer hash de senha
CREATE OR REPLACE FUNCTION public.hash_password(p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf', 10));
END;
$$;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION public.verify_password(p_password text, p_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN p_hash = crypt(p_password, p_hash);
END;
$$;

-- Atualizar função de login para usar hash
CREATE OR REPLACE FUNCTION public.validate_login(p_email text, p_key text)
RETURNS TABLE(
  id integer,
  nome character varying,
  email character varying,
  creditos integer,
  rank text,
  profile_photo text,
  has_pin boolean,
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin record;
  v_new_token text;
BEGIN
  -- Buscar admin por email
  SELECT a.id, a.nome, a.email, a.creditos, a.rank, a.profile_photo, a.key,
         (a.pin IS NOT NULL AND a.pin != '') as has_pin
  INTO v_admin
  FROM public.admins a
  WHERE a.email = p_email;
  
  IF v_admin IS NULL THEN
    RETURN;
  END IF;
  
  -- Verificar senha: suporta tanto hash bcrypt quanto texto plano (para migração)
  IF NOT (
    -- Verificar como hash bcrypt (senhas já migradas)
    (v_admin.key LIKE '$2a$%' OR v_admin.key LIKE '$2b$%') AND public.verify_password(p_key, v_admin.key)
    OR
    -- Verificar como texto plano (senhas antigas - será migrado automaticamente)
    (NOT (v_admin.key LIKE '$2a$%' OR v_admin.key LIKE '$2b$%') AND v_admin.key = p_key)
  ) THEN
    RETURN;
  END IF;
  
  -- Se senha está em texto plano, migrar para hash automaticamente
  IF NOT (v_admin.key LIKE '$2a$%' OR v_admin.key LIKE '$2b$%') THEN
    UPDATE public.admins 
    SET key = public.hash_password(p_key)
    WHERE admins.id = v_admin.id;
  END IF;
  
  -- Gerar novo token de sessão
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Atualizar token de sessão e last_active
  UPDATE public.admins 
  SET session_token = v_new_token, last_active = now()
  WHERE admins.id = v_admin.id;
  
  -- Retornar dados
  RETURN QUERY SELECT 
    v_admin.id,
    v_admin.nome,
    v_admin.email,
    v_admin.creditos,
    v_admin.rank,
    v_admin.profile_photo,
    v_admin.has_pin,
    v_new_token;
END;
$$;

-- Atualizar função de criar master para usar hash
CREATE OR REPLACE FUNCTION public.create_master(
  p_creator_id integer, 
  p_session_token text,
  p_nome text,
  p_email text,
  p_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank text;
  v_new_id integer;
  v_hashed_key text;
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_creator_id, p_session_token) THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  
  -- Verificar se é dono
  SELECT rank INTO v_rank FROM public.admins WHERE id = p_creator_id;
  IF v_rank != 'dono' THEN
    RAISE EXCEPTION 'Apenas donos podem criar masters';
  END IF;
  
  -- Verificar se email já existe
  IF EXISTS(SELECT 1 FROM public.admins WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email já cadastrado';
  END IF;
  
  -- Hash da senha
  v_hashed_key := public.hash_password(p_key);
  
  -- Criar master
  INSERT INTO public.admins (nome, email, key, rank, criado_por, creditos)
  VALUES (p_nome, p_email, v_hashed_key, 'master', p_creator_id, 0)
  RETURNING admins.id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Atualizar função de criar revendedor para usar hash
CREATE OR REPLACE FUNCTION public.create_reseller(
  p_creator_id integer, 
  p_session_token text,
  p_nome text,
  p_email text,
  p_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank text;
  v_new_id integer;
  v_hashed_key text;
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_creator_id, p_session_token) THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  
  -- Verificar se é master
  SELECT rank INTO v_rank FROM public.admins WHERE id = p_creator_id;
  IF v_rank != 'master' THEN
    RAISE EXCEPTION 'Apenas masters podem criar revendedores';
  END IF;
  
  -- Verificar se email já existe
  IF EXISTS(SELECT 1 FROM public.admins WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email já cadastrado';
  END IF;
  
  -- Hash da senha
  v_hashed_key := public.hash_password(p_key);
  
  -- Criar revendedor
  INSERT INTO public.admins (nome, email, key, rank, criado_por, creditos)
  VALUES (p_nome, p_email, v_hashed_key, 'revendedor', p_creator_id, 0)
  RETURNING admins.id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para hash do PIN também (melhoria adicional)
CREATE OR REPLACE FUNCTION public.set_admin_pin(p_admin_id integer, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hashed_pin text;
BEGIN
  -- Hash do PIN
  v_hashed_pin := public.hash_password(p_pin);
  
  UPDATE public.admins
  SET pin = v_hashed_pin
  WHERE id = p_admin_id;
  
  RETURN FOUND;
END;
$$;

-- Atualizar validate_pin para verificar hash
CREATE OR REPLACE FUNCTION public.validate_pin(p_admin_id integer, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_pin text;
BEGIN
  SELECT pin INTO v_stored_pin
  FROM public.admins
  WHERE id = p_admin_id;
  
  IF v_stored_pin IS NULL OR v_stored_pin = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar: suporta hash bcrypt e texto plano (para migração)
  IF v_stored_pin LIKE '$2a$%' OR v_stored_pin LIKE '$2b$%' THEN
    -- PIN com hash
    RETURN public.verify_password(p_pin, v_stored_pin);
  ELSE
    -- PIN em texto plano (legado)
    IF v_stored_pin = p_pin THEN
      -- Migrar para hash
      UPDATE public.admins 
      SET pin = public.hash_password(p_pin)
      WHERE id = p_admin_id;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;
END;
$$;