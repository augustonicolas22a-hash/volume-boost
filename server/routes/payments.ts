import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Tabela de preços
const PRICE_TIERS = [
  { quantity: 50, unitPrice: 1.20, totalPrice: 60.00 },
  { quantity: 100, unitPrice: 1.00, totalPrice: 100.00 },
  { quantity: 200, unitPrice: 0.90, totalPrice: 180.00 },
  { quantity: 500, unitPrice: 0.80, totalPrice: 400.00 },
  { quantity: 1000, unitPrice: 0.70, totalPrice: 700.00 },
  { quantity: 2000, unitPrice: 0.60, totalPrice: 1200.00 },
  { quantity: 5000, unitPrice: 0.50, totalPrice: 2500.00 },
];

// Criar pagamento PIX
router.post('/pix/create', async (req, res) => {
  try {
    const { credits, adminId, adminName } = req.body;

    const tier = PRICE_TIERS.find(t => t.quantity === credits);
    if (!tier) {
      return res.status(400).json({ error: 'Pacote de créditos inválido' });
    }

    // Aqui você integraria com sua API de pagamento PIX
    const transactionId = `PIX_${Date.now()}_${adminId}`;

    await query(
      'INSERT INTO pix_payments (admin_id, admin_name, credits, amount, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [adminId, adminName, credits, tier.totalPrice, transactionId, 'PENDING']
    );

    res.json({
      transactionId,
      amount: tier.totalPrice,
      credits: tier.quantity,
      // Adicione aqui os dados do QR Code PIX da sua API
      qrCode: 'SEU_QRCODE_PIX',
      qrCodeBase64: 'BASE64_DO_QRCODE'
    });
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar status do pagamento
router.get('/pix/status/:transactionId', async (req, res) => {
  try {
    const payments = await query<any[]>(
      'SELECT * FROM pix_payments WHERE transaction_id = ?',
      [req.params.transactionId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    res.json(payments[0]);
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Webhook de pagamento (chamado pela API de pagamento)
router.post('/pix/webhook', async (req, res) => {
  try {
    const { transactionId, status } = req.body;

    if (status === 'COMPLETED' || status === 'PAID') {
      const payments = await query<any[]>(
        'SELECT * FROM pix_payments WHERE transaction_id = ? AND status = ?',
        [transactionId, 'PENDING']
      );

      if (payments.length > 0) {
        const payment = payments[0];

        // Atualizar status do pagamento
        await query(
          'UPDATE pix_payments SET status = ?, paid_at = NOW() WHERE transaction_id = ?',
          ['PAID', transactionId]
        );

        // Adicionar créditos ao admin
        const tier = PRICE_TIERS.find(t => t.quantity === payment.credits);
        if (tier) {
          await query(
            'UPDATE admins SET creditos = creditos + ? WHERE id = ?',
            [payment.credits, payment.admin_id]
          );

          await query(
            'INSERT INTO credit_transactions (to_admin_id, amount, unit_price, total_price, transaction_type) VALUES (?, ?, ?, ?, ?)',
            [payment.admin_id, payment.credits, tier.unitPrice, tier.totalPrice, 'recharge']
          );
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter tabela de preços
router.get('/price-tiers', async (req, res) => {
  try {
    const tiers = await query<any[]>(
      'SELECT * FROM price_tiers WHERE is_active = TRUE ORDER BY min_qty'
    );

    res.json(tiers.length > 0 ? tiers : PRICE_TIERS);
  } catch (error) {
    console.error('Erro ao buscar preços:', error);
    res.json(PRICE_TIERS);
  }
});

// Metas mensais
router.get('/goals/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;

    const goals = await query<any[]>(
      'SELECT * FROM monthly_goals WHERE year = ? AND month = ?',
      [year, month]
    );

    res.json(goals[0] || { target_revenue: 0 });
  } catch (error) {
    console.error('Erro ao buscar meta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar meta mensal
router.post('/goals', async (req, res) => {
  try {
    const { year, month, targetRevenue } = req.body;

    await query(
      `INSERT INTO monthly_goals (year, month, target_revenue) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE target_revenue = ?, updated_at = NOW()`,
      [year, month, targetRevenue, targetRevenue]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar meta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
