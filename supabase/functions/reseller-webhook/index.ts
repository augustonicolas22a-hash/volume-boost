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
    const body = await req.json();
    console.log('📨 Reseller webhook received:', JSON.stringify(body, null, 2));
    
    const { event, transaction } = body;
    
    if (!transaction || !transaction.id) {
      console.error("❌ Dados da transação não encontrados");
      return new Response(JSON.stringify({ error: "Dados da transação não encontrados" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const transactionId = transaction.id;
    const transactionStatus = transaction.status;
    
    console.log(`📋 Event: ${event}, Transaction ID: ${transactionId}, Status: ${transactionStatus}`);
    
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
    
    // Verifica se é pagamento de revendedor
    if (!payment.admin_name?.startsWith('RESELLER:')) {
      console.log("⚠️ Não é pagamento de revendedor");
      return new Response(JSON.stringify({ received: true, message: "Não é pagamento de revendedor" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Verifica se o evento é de pagamento confirmado
    const isPaid = event === "TRANSACTION_PAID" || transactionStatus === "COMPLETED" || transactionStatus === "PAID";
    
    if (isPaid) {
      console.log("✅ Pagamento de revendedor confirmado!");
      
      if (payment.status === "PAID") {
        console.log("⚠️ Pagamento já foi processado");
        return new Response(JSON.stringify({ received: true, message: "Já processado" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Extrair dados do revendedor do admin_name
      try {
        const resellerJson = payment.admin_name.replace('RESELLER:', '');
        const resellerData = JSON.parse(resellerJson);
        
        console.log('📋 Dados do revendedor:', { ...resellerData, key: '***' });
        
        // Verificar se já existe
        const { data: existingAdmin } = await supabase
          .from('admins')
          .select('id')
          .eq('email', resellerData.email)
          .single();
        
        if (!existingAdmin) {
          // Criar o revendedor usando a função RPC
          const { data: newId, error: createError } = await supabase.rpc('create_reseller', {
            p_creator_id: resellerData.masterId,
            p_session_token: 'webhook_bypass', // Bypass de sessão para webhook
            p_nome: resellerData.nome,
            p_email: resellerData.email,
            p_key: resellerData.key
          });
          
          if (createError) {
            console.error('Erro ao criar revendedor via RPC:', createError);
            
            // Fallback: inserir diretamente com hash
            const { data: hashData } = await supabase.rpc('hash_password', {
              p_password: resellerData.key
            });
            
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
              console.error('Erro ao inserir revendedor:', insertError);
            } else {
              console.log('✅ Revendedor criado via fallback!');
            }
          } else {
            console.log('✅ Revendedor criado com ID:', newId);
            
            // Adicionar créditos iniciais
            await supabase
              .from('admins')
              .update({ creditos: RESELLER_CREDITS })
              .eq('id', newId);
          }
        } else {
          console.log('⚠️ Revendedor já existe:', existingAdmin.id);
        }
        
      } catch (parseError) {
        console.error('Erro ao parsear dados do revendedor:', parseError);
      }
      
      // Update payment status
      await supabase
        .from('pix_payments')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('transaction_id', transactionId);
      
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Reseller webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
