import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESELLER_CREDITS = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const transactionId = url.pathname.split('/').pop();
    
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Transaction ID não fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Checking reseller payment status for:', transactionId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find payment
    const { data: payment, error: paymentError } = await supabase
      .from('pix_payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (paymentError || !payment) {
      console.error("❌ Pagamento não encontrado:", transactionId);
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se ainda está pendente, consulta VizzionPay
    if (payment.status === 'PENDING') {
      console.log('🔄 Status PENDING, consultando VizzionPay...');
      
      const publicKey = Deno.env.get('VIZZIONPAY_PUBLIC_KEY');
      const privateKey = Deno.env.get('VIZZIONPAY_PRIVATE_KEY');
      
      if (publicKey && privateKey) {
        try {
          const vizzionResponse = await fetch(`https://app.vizzionpay.com/api/v1/gateway/pix/${transactionId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-public-key': publicKey,
              'x-secret-key': privateKey,
            },
          });
          
          if (vizzionResponse.ok) {
            const vizzionData = await vizzionResponse.json();
            console.log('📦 VizzionPay response:', JSON.stringify(vizzionData, null, 2));
            
            const remoteEvent = vizzionData.event;
            const remoteStatus = vizzionData.status || vizzionData.transaction?.status;
            
            const isPaid = remoteEvent === 'TRANSACTION_PAID' || 
                          remoteStatus === 'PAID' || 
                          remoteStatus === 'COMPLETED';
            
            if (isPaid) {
              console.log('✅ Pagamento confirmado via VizzionPay!');
              
              // Verificar se é pagamento de revendedor
              if (payment.admin_name?.startsWith('RESELLER:')) {
                try {
                  const resellerJson = payment.admin_name.replace('RESELLER:', '');
                  const resellerData = JSON.parse(resellerJson);
                  
                  console.log('📋 Criando revendedor:', { ...resellerData, key: '***' });
                  
                  // Verificar se já existe
                  const { data: existingAdmin } = await supabase
                    .from('admins')
                    .select('id')
                    .eq('email', resellerData.email)
                    .single();
                  
                  if (!existingAdmin) {
                    // Hash da senha
                    const { data: hashData } = await supabase.rpc('hash_password', {
                      p_password: resellerData.key
                    });
                    
                    // Criar revendedor
                    const { error: insertError } = await supabase
                      .from('admins')
                      .insert({
                        nome: resellerData.nome,
                        email: resellerData.email,
                        key: hashData || resellerData.key,
                        rank: 'revendedor',
                        criado_por: resellerData.masterId,
                        creditos: RESELLER_CREDITS
                      });
                    
                    if (insertError) {
                      console.error('Erro ao criar revendedor:', insertError);
                    } else {
                      console.log('✅ Revendedor criado com sucesso!');
                    }
                  } else {
                    console.log('⚠️ Revendedor já existe');
                  }
                  
                } catch (parseError) {
                  console.error('Erro ao parsear dados:', parseError);
                }
              }
              
              // Atualizar status
              await supabase
                .from('pix_payments')
                .update({ status: 'PAID', paid_at: new Date().toISOString() })
                .eq('transaction_id', transactionId)
                .eq('status', 'PENDING');
              
              return new Response(JSON.stringify({
                status: 'PAID',
                transactionId: payment.transaction_id,
                amount: payment.amount,
                credits: payment.credits,
                message: "Pagamento confirmado - Revendedor criado!"
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch (vizzionError) {
          console.error('Erro ao consultar VizzionPay:', vizzionError);
        }
      }
    }
    
    return new Response(JSON.stringify({
      status: payment.status,
      transactionId: payment.transaction_id,
      amount: payment.amount,
      credits: payment.credits,
      message: payment.status === "PAID" ? "Pagamento confirmado" : "Aguardando pagamento"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Erro ao verificar status:", error);
    return new Response(JSON.stringify({ error: "Erro ao verificar status" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
