-- =============================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA
-- Restringir acesso à tabela admins
-- =============================================

-- Remover função existente com assinatura diferente
DROP FUNCTION IF EXISTS public.validate_login(text, text);

-- Remover política permissiva que expõe todos os dados
DROP POLICY IF EXISTS admins_select_policy ON public.admins;

-- Criar nova política restritiva
-- Apenas funções SECURITY DEFINER podem acessar (via service_role)
CREATE POLICY "admins_select_service_only" ON public.admins
  FOR SELECT
  USING (false);

-- Política para price_tiers - restringir também
DROP POLICY IF EXISTS price_tiers_select_policy ON public.price_tiers;

CREATE POLICY "price_tiers_select_service_only" ON public.price_tiers
  FOR SELECT
  USING (false);

-- =============================================
-- Criar funções SECURITY DEFINER seguras
-- Essas funções usam service_role internamente
-- =============================================

-- Função para validar login
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
  -- Buscar admin por email e key
  SELECT a.id, a.nome, a.email, a.creditos, a.rank, a.profile_photo, 
         (a.pin IS NOT NULL AND a.pin != '') as has_pin
  INTO v_admin
  FROM public.admins a
  WHERE a.email = p_email AND a.key = p_key;
  
  IF v_admin IS NULL THEN
    RETURN;
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

-- Função para validar PIN
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
  
  RETURN v_stored_pin IS NOT NULL AND v_stored_pin = p_pin;
END;
$$;

-- Função para definir PIN
CREATE OR REPLACE FUNCTION public.set_admin_pin(p_admin_id integer, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admins
  SET pin = p_pin
  WHERE id = p_admin_id;
  
  RETURN FOUND;
END;
$$;

-- Função para validar sessão
CREATE OR REPLACE FUNCTION public.is_valid_admin(p_admin_id integer, p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.admins
    WHERE id = p_admin_id AND session_token = p_session_token
  ) INTO v_valid;
  
  IF v_valid THEN
    UPDATE public.admins SET last_active = now() WHERE id = p_admin_id;
  END IF;
  
  RETURN v_valid;
END;
$$;

-- Função para logout (invalidar sessão)
CREATE OR REPLACE FUNCTION public.logout_admin(p_admin_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admins
  SET session_token = NULL
  WHERE id = p_admin_id;
  
  RETURN FOUND;
END;
$$;

-- Função para buscar admin por ID (segura)
CREATE OR REPLACE FUNCTION public.get_admin_by_id(p_admin_id integer, p_session_token text)
RETURNS TABLE(
  id integer,
  nome character varying,
  email character varying,
  creditos integer,
  rank text,
  profile_photo text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar sessão primeiro
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    a.id, a.nome, a.email, a.creditos, a.rank, a.profile_photo, a.created_at
  FROM public.admins a
  WHERE a.id = p_admin_id;
END;
$$;

-- Função para buscar revendedores de um master
CREATE OR REPLACE FUNCTION public.get_resellers_by_master(p_master_id integer, p_session_token text)
RETURNS TABLE(
  id integer,
  nome character varying,
  email character varying,
  creditos integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_master_id, p_session_token) THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    a.id, a.nome, a.email, a.creditos, a.created_at
  FROM public.admins a
  WHERE a.criado_por = p_master_id AND a.rank = 'revendedor'
  ORDER BY a.created_at DESC;
END;
$$;

-- Função para buscar todos os masters (apenas para dono)
CREATE OR REPLACE FUNCTION public.get_all_masters(p_admin_id integer, p_session_token text)
RETURNS TABLE(
  id integer,
  nome character varying,
  email character varying,
  creditos integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank text;
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN;
  END IF;
  
  -- Verificar se é dono
  SELECT rank INTO v_rank FROM public.admins WHERE admins.id = p_admin_id;
  IF v_rank != 'dono' THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    a.id, a.nome, a.email, a.creditos, a.created_at
  FROM public.admins a
  WHERE a.rank = 'master'
  ORDER BY a.created_at DESC;
END;
$$;

-- Função para criar master (apenas dono)
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
  
  -- Criar master
  INSERT INTO public.admins (nome, email, key, rank, criado_por, creditos)
  VALUES (p_nome, p_email, p_key, 'master', p_creator_id, 0)
  RETURNING admins.id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para criar revendedor (apenas master)
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
  
  -- Criar revendedor
  INSERT INTO public.admins (nome, email, key, rank, criado_por, creditos)
  VALUES (p_nome, p_email, p_key, 'revendedor', p_creator_id, 0)
  RETURNING admins.id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função para buscar saldo
CREATE OR REPLACE FUNCTION public.get_admin_balance(p_admin_id integer, p_session_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN NULL;
  END IF;
  
  SELECT creditos INTO v_credits FROM public.admins WHERE id = p_admin_id;
  RETURN v_credits;
END;
$$;

-- Função para buscar price_tiers (apenas para admins autenticados)
CREATE OR REPLACE FUNCTION public.get_price_tiers(p_admin_id integer, p_session_token text)
RETURNS TABLE(
  id integer,
  min_qty integer,
  max_qty integer,
  price numeric,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    pt.id, pt.min_qty, pt.max_qty, pt.price, pt.is_active
  FROM public.price_tiers pt
  WHERE pt.is_active = true
  ORDER BY pt.min_qty;
END;
$$;

-- Função para buscar estatísticas do dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_admin_id integer, p_session_token text)
RETURNS TABLE(
  total_masters bigint,
  total_resellers bigint,
  total_credits bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank text;
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN;
  END IF;
  
  -- Verificar se é dono
  SELECT rank INTO v_rank FROM public.admins WHERE id = p_admin_id;
  IF v_rank != 'dono' THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    (SELECT COUNT(*) FROM public.admins WHERE rank = 'master'),
    (SELECT COUNT(*) FROM public.admins WHERE rank = 'revendedor'),
    (SELECT COALESCE(SUM(creditos), 0) FROM public.admins);
END;
$$;

-- Função para pesquisa de admin
CREATE OR REPLACE FUNCTION public.search_admins(p_admin_id integer, p_session_token text, p_query text)
RETURNS TABLE(
  id integer,
  nome character varying,
  email character varying,
  creditos integer,
  rank text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar sessão
  IF NOT public.is_valid_admin(p_admin_id, p_session_token) THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    a.id, a.nome, a.email, a.creditos, a.rank
  FROM public.admins a
  WHERE a.nome ILIKE '%' || p_query || '%' 
     OR a.email ILIKE '%' || p_query || '%'
  LIMIT 20;
END;
$$;