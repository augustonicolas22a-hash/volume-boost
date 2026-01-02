import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, credits, adminId, adminName, packageId } = await req.json();
    
    console.log('=== PIX PAYMENT REQUEST ===');
    console.log('Request body:', { amount, credits, adminId, adminName, packageId });
    
    // Validate input
    if (!amount || !credits || !adminId || !adminName || 
        typeof amount !== 'number' || typeof credits !== 'number' || 
        typeof adminId !== 'number' || typeof adminName !== 'string') {
      return new Response(JSON.stringify({ error: "Dados incompletos ou inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (amount <= 0 || amount > 10000 || credits <= 0 || credits > 250) {
      return new Response(JSON.stringify({ error: "Valores fora dos limites permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin exists
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, nome')
      .eq('id', adminId)
      .single();

    if (adminError || !admin) {
      console.error('Admin not found:', adminError);
      return new Response(JSON.stringify({ error: "Admin não encontrado" }), {
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

    const sanitizedAdminName = adminName.replace(/[<>\"'&]/g, '').trim().substring(0, 50);
    const identifier = `ADMIN_${adminId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Calculate split (5% for partner)
    const amountSplit = Math.round(amount * 0.05 * 100) / 100;
    
    const pixRequest = {
      identifier: identifier,
      amount: Math.round(amount * 100) / 100,
      client: {
        name: sanitizedAdminName,
        email: `admin${adminId}@sistema.com`,
        phone: "(00) 00000-0000",
        document: "00000000000"
      },
      splits: [
        {
          producerId: 'cmd80ujse00klosducwe52nkw',
          amount: amountSplit
        }
      ],
      callbackUrl: `${supabaseUrl}/functions/v1/vizzionpay-webhook`
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
      throw new Error(`VizzionPay error: ${vizzionResponse.status} - ${errorData}`);
    }

    const pixData = await vizzionResponse.json();
    console.log('📨 VizzionPay response received:', JSON.stringify(pixData, null, 2));

    if (!pixData.transactionId || typeof pixData.transactionId !== 'string') {
      throw new Error('Invalid VizzionPay response');
    }

    // Save payment to database
    const { error: insertError } = await supabase
      .from('pix_payments')
      .insert({
        admin_id: adminId,
        admin_name: sanitizedAdminName,
        transaction_id: pixData.transactionId,
        amount: Math.round(amount * 100) / 100,
        credits: credits,
        status: 'PENDING'
      });

    if (insertError) {
      console.error('Error saving payment:', insertError);
      throw new Error('Erro ao salvar pagamento no banco');
    }

    console.log('✅ Pagamento PIX salvo no banco de dados com transactionId:', pixData.transactionId);

    const responseData = {
      transactionId: pixData.transactionId,
      qrCode: pixData.pix?.code || pixData.qrCode || pixData.copyPaste,
      qrCodeBase64: pixData.pix?.base64 || pixData.qrCodeBase64,
      copyPaste: pixData.pix?.code || pixData.copyPaste || pixData.qrCode,
      amount: amount,
      dueDate: pixData.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "PENDING"
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PIX Payment Error:', error);
    return new Response(JSON.stringify({ 
      error: "Erro ao criar pagamento PIX", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
