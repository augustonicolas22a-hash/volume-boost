import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📨 VizzionPay webhook received:', JSON.stringify(body, null, 2));
    
    const { event, transaction } = body;
    
    if (!transaction || !transaction.id) {
      console.error("❌ Dados da transação não encontrados no webhook");
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
      console.error("❌ Pagamento não encontrado no banco de dados:", transactionId);
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Verifica se o evento é de pagamento confirmado
    // VizzionPay envia: event = "TRANSACTION_PAID" e status = "COMPLETED"
    const isPaid = event === "TRANSACTION_PAID" || transactionStatus === "COMPLETED";
    
    if (isPaid) {
      console.log("✅ Pagamento confirmado, processando...");
      
      if (payment.status === "PAID") {
        console.log("⚠️ Pagamento já foi processado anteriormente");
        return new Response(JSON.stringify({ received: true, message: "Pagamento já processado" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Update payment status
      const { error: updatePaymentError } = await supabase
        .from('pix_payments')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('transaction_id', transactionId);

      if (updatePaymentError) {
        console.error('Error updating payment status:', updatePaymentError);
      }
      
      // Use RPC for atomic credit update
      const { error: rpcError } = await supabase.rpc('recharge_credits', {
        p_admin_id: payment.admin_id,
        p_amount: payment.credits,
        p_unit_price: payment.amount / payment.credits,
        p_total_price: payment.amount
      });

      if (rpcError) {
        console.error('Error adding credits via RPC:', rpcError);
      } else {
        console.log(`✅ ${payment.credits} créditos adicionados ao admin ${payment.admin_id}`);
      }
      
    } else {
      console.log(`ℹ️ Evento: ${event}, Status: ${transactionStatus} - não é pagamento confirmado`);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
