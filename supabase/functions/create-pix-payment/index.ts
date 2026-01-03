import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side price tiers - MUST match frontend exactly
const PRICE_TIERS = [
  { credits: 10, unitPrice: 14, total: 140 },
  { credits: 15, unitPrice: 13.80, total: 207 },
  { credits: 25, unitPrice: 13.50, total: 337.50 },
  { credits: 30, unitPrice: 13.30, total: 399 },
  { credits: 50, unitPrice: 13, total: 650 },
  { credits: 75, unitPrice: 12.50, total: 937.50 },
  { credits: 100, unitPrice: 12, total: 1200 },
  { credits: 150, unitPrice: 11.50, total: 1725 },
  { credits: 200, unitPrice: 11, total: 2200 },
  { credits: 250, unitPrice: 10.50, total: 2625 },
  { credits: 300, unitPrice: 10.20, total: 3060 },
  { credits: 350, unitPrice: 10, total: 3500 },
  { credits: 400, unitPrice: 9.80, total: 3920 },
  { credits: 500, unitPrice: 9.60, total: 4800 },
  { credits: 550, unitPrice: 9.50, total: 5225 },
  { credits: 600, unitPrice: 9.40, total: 5640 },
  { credits: 650, unitPrice: 9.30, total: 6045 },
];

// Allowed credit packages - ONLY these are valid
const ALLOWED_PACKAGES = [10, 15, 25, 30, 50, 75, 100, 150, 200, 250, 300, 350, 400, 500, 550, 600, 650];

function calculatePrice(quantity: number): { unitPrice: number; total: number } | null {
  // Only allow exact package amounts
  if (!ALLOWED_PACKAGES.includes(quantity)) {
    return null;
  }
  const tier = PRICE_TIERS.find(t => t.credits === quantity);
  if (!tier) return null;
  return { unitPrice: tier.unitPrice, total: tier.total };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credits, adminId, adminName, sessionToken } = await req.json();
    
    console.log('=== PIX PAYMENT REQUEST ===');
    console.log('Request body:', { credits, adminId, adminName });
    
    // Validate input types
    if (!credits || !adminId || !adminName || !sessionToken ||
        typeof credits !== 'number' || typeof adminId !== 'number' || 
        typeof adminName !== 'string' || typeof sessionToken !== 'string') {
      console.error('Invalid input types');
      return new Response(JSON.stringify({ error: "Dados incompletos ou inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate credits is an allowed package
    if (!ALLOWED_PACKAGES.includes(credits)) {
      console.error('Invalid credits package:', credits);
      return new Response(JSON.stringify({ error: "Pacote de créditos inválido" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate price server-side
    const pricing = calculatePrice(credits);
    if (!pricing) {
      console.error('Could not calculate price for:', credits);
      return new Response(JSON.stringify({ error: "Erro ao calcular preço" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { total: amount } = pricing;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin exists AND session token matches (prevents manipulation)
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, nome, rank, session_token')
      .eq('id', adminId)
      .single();

    if (adminError || !admin) {
      console.error('Admin not found:', adminError);
      return new Response(JSON.stringify({ error: "Admin não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate session token - prevents localStorage manipulation
    if (admin.session_token !== sessionToken) {
      console.error('Session token mismatch');
      return new Response(JSON.stringify({ error: "Sessão inválida. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify only masters can recharge
    if (admin.rank !== 'master') {
      console.error('Non-master trying to recharge');
      return new Response(JSON.stringify({ error: "Apenas masters podem recarregar" }), {
        status: 403,
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
    
    const pixRequest: any = {
      identifier: identifier,
      amount: Math.round(amount * 100) / 100,
      client: {
        name: sanitizedAdminName,
        email: `admin${adminId}@sistema.com`,
        phone: "(83) 99999-9999",
        document: "05916691378"
      },
      callbackUrl: `${supabaseUrl}/functions/v1/vizzionpay-webhook`
    };

    if (amount > 10) {
      const amountSplit = Math.round(amount * 0.05 * 100) / 100;
      pixRequest.splits = [
        {
          producerId: 'cmd80ujse00klosducwe52nkw',
          amount: amountSplit
        }
      ];
    }

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
    console.log('VizzionPay response received:', JSON.stringify(pixData, null, 2));

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

    console.log('Pagamento PIX salvo no banco de dados com transactionId:', pixData.transactionId);

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