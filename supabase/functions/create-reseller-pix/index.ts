import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preço e créditos para ativação de revendedor
const RESELLER_PRICE = 2.00; // R$2,00 para teste
const RESELLER_CREDITS = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { masterId, masterName, resellerData } = await req.json();
    
    console.log('=== CREATE RESELLER PIX REQUEST ===');
    console.log('Request body:', { masterId, masterName, resellerData: { ...resellerData, key: '***' } });
    
    // Validação dos dados
    if (!masterId || !masterName || !resellerData) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { nome, email, key } = resellerData;
    
    if (!nome || !email || !key) {
      return new Response(JSON.stringify({ error: "Dados do revendedor incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se o email já existe
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingAdmin) {
      return new Response(JSON.stringify({ error: "Este email já está cadastrado" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get VizzionPay credentials
    const publicKey = Deno.env.get('VIZZIONPAY_PUBLIC_KEY');
    const privateKey = Deno.env.get('VIZZIONPAY_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      console.error('VizzionPay credentials not configured');
      return new Response(JSON.stringify({ error: "Chaves da VizzionPay não configuradas" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const identifier = `RESELLER_${masterId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const sanitizedName = nome.replace(/[<>\"'&]/g, '').trim().substring(0, 50);
    
    const pixRequest: any = {
      identifier: identifier,
      amount: RESELLER_PRICE,
      client: {
        name: sanitizedName,
        email: email.toLowerCase().trim(),
        phone: "(83) 99999-9999",
        document: "05916691378"
      },
      callbackUrl: `${supabaseUrl}/functions/v1/reseller-webhook`
    };

    console.log('VizzionPay request:', JSON.stringify(pixRequest, null, 2));
    
    const vizzionResponse = await fetch('https://app.vizzionpay.com/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': privateKey,
      },
      body: JSON.stringify(pixRequest),
    });
    
    console.log('VizzionPay response status:', vizzionResponse.status);

    if (!vizzionResponse.ok) {
      const errorData = await vizzionResponse.text();
      console.error('VizzionPay error response:', errorData);
      throw new Error(`VizzionPay error: ${vizzionResponse.status}`);
    }

    const pixData = await vizzionResponse.json();
    console.log('VizzionPay response:', JSON.stringify(pixData, null, 2));

    if (!pixData.transactionId) {
      throw new Error('Invalid VizzionPay response');
    }

    // Salva o pagamento com os dados do revendedor no admin_name (prefixo RESELLER:)
    const resellerDataJson = JSON.stringify({ nome, email: email.toLowerCase().trim(), key, masterId });
    
    const { error: insertError } = await supabase
      .from('pix_payments')
      .insert({
        admin_id: masterId,
        admin_name: `RESELLER:${resellerDataJson}`,
        transaction_id: pixData.transactionId,
        amount: RESELLER_PRICE,
        credits: RESELLER_CREDITS,
        status: 'PENDING'
      });

    if (insertError) {
      console.error('Error saving payment:', insertError);
      throw new Error('Erro ao salvar pagamento');
    }

    console.log('✅ PIX de revendedor salvo com transactionId:', pixData.transactionId);

    return new Response(JSON.stringify({
      transactionId: pixData.transactionId,
      qrCode: pixData.pix?.code || pixData.qrCode || pixData.copyPaste,
      qrCodeBase64: pixData.pix?.base64 || pixData.qrCodeBase64,
      copyPaste: pixData.pix?.code || pixData.copyPaste || pixData.qrCode,
      amount: RESELLER_PRICE,
      credits: RESELLER_CREDITS,
      status: "PENDING"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Create Reseller PIX Error:', error);
    return new Response(JSON.stringify({ 
      error: "Erro ao criar PIX para revendedor", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
