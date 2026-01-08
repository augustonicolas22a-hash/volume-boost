-- Atualizar função transfer_credits para validar sessão do admin
CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_from_admin_id INTEGER,
  p_to_admin_id INTEGER,
  p_amount INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance INTEGER;
  v_from_rank TEXT;
  v_to_criado_por INTEGER;
BEGIN
  -- Validar quantidade mínima de 3 créditos
  IF p_amount < 3 THEN
    RAISE EXCEPTION 'Quantidade mínima para transferência é 3 créditos';
  END IF;

  -- Verificar se o admin de origem existe e obter seu rank
  SELECT creditos, rank INTO v_from_balance, v_from_rank
  FROM public.admins 
  WHERE id = p_from_admin_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin de origem não encontrado';
  END IF;
  
  -- Verificar se o admin de destino existe e foi criado pelo remetente (para master->revendedor)
  SELECT criado_por INTO v_to_criado_por
  FROM public.admins 
  WHERE id = p_to_admin_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin de destino não encontrado';
  END IF;
  
  -- Verificar permissão: master só pode transferir para seus revendedores
  IF v_from_rank = 'master' AND v_to_criado_por != p_from_admin_id THEN
    RAISE EXCEPTION 'Você só pode transferir para seus próprios revendedores';
  END IF;
  
  -- Verificar saldo suficiente
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;
  
  -- Debitar do remetente
  UPDATE public.admins 
  SET creditos = creditos - p_amount, last_active = NOW() 
  WHERE id = p_from_admin_id;
  
  -- Creditar ao destinatário
  UPDATE public.admins 
  SET creditos = creditos + p_amount, last_active = NOW() 
  WHERE id = p_to_admin_id;
  
  -- Registrar transação
  INSERT INTO public.credit_transactions (from_admin_id, to_admin_id, amount, transaction_type)
  VALUES (p_from_admin_id, p_to_admin_id, p_amount, 'transfer');
  
  RETURN TRUE;
END;
$$;