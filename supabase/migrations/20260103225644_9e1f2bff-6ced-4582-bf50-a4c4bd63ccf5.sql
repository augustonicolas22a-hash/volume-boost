-- Corrigir função validate_login para usar gen_random_uuid nativo
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
  
  -- Gerar novo token de sessão usando gen_random_uuid (nativo)
  v_new_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  
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