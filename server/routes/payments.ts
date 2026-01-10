import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Tabela de preços - DEVE bater com o frontend
const PRICE_TIERS = [
  { credits: 5, unitPrice: 14.00, total: 70 },
  { credits: 10, unitPrice: 14.00, total: 140 },
  { credits: 25, unitPrice: 13.50, total: 337.50 },
  { credits: 50, unitPrice: 13.00, total: 650 },
  { credits: 75, unitPrice: 12.50, total: 937.50 },
  { credits: 100, unitPrice: 12.00, total: 1200 },
  { credits: 150, unitPrice: 11.50, total: 1725 },
  { credits: 200, unitPrice: 11.00, total: 2200 },
  { credits: 250, unitPrice: 10.50, total: 2625 },
  { credits: 300, unitPrice: 10.20, total: 3060 },
  { credits: 400, unitPrice: 9.80, total: 3920 },
  { credits: 500, unitPrice: 9.65, total: 4825 },
  { credits: 1000, unitPrice: 9.00, total: 9000 },
];

const ALLOWED_PACKAGES = [5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 1000];

function calculatePrice(quantity: number): { unitPrice: number; total: number } | null {
  if (!ALLOWED_PACKAGES.includes(quantity)) {
    return null;
  }
  const tier = PRICE_TIERS.find(t => t.credits === quantity);
  if (!tier) return null;
  return { unitPrice: tier.unitPrice, total: tier.total };
}

// Criar pagamento PIX via VizzionPay
router.post('/create-pix', async (req, res) => {
  try {
    const { credits, adminId, adminName } = req.body;

    console.log('=== PIX PAYMENT REQUEST (MySQL) ===');
    console.log('Request body:', { credits, adminId, adminName });

    // Validar input
    if (!credits || !adminId || !adminName ||
        typeof credits !== 'number' || typeof adminId !== 'number' || 
        typeof adminName !== 'string') {
      return res.status(400).json({ error: 'Dados incompletos ou inválidos' });
    }

    // Validar pacote de créditos
    if (!ALLOWED_PACKAGES.includes(credits)) {
      return res.status(400).json({ error: 'Pacote de créditos inválido' });
    }

    // Calcular preço
    const pricing = calculatePrice(credits);
    if (!pricing) {
      return res.status(400).json({ error: 'Erro ao calcular preço' });
    }

    const { total: amount } = pricing;

    // Verificar se admin existe
    const admins = await query<any[]>('SELECT id, nome, rank FROM admins WHERE id = ?', [adminId]);
    if (admins.length === 0) {
      return res.status(400).json({ error: 'Admin não encontrado' });
    }

    // Verificar se é master
    if (admins[0].rank !== 'master') {
      return res.status(403).json({ error: 'Apenas masters podem recarregar' });
    }

    // Credenciais VizzionPay
    const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
    const privateKey = process.env.VIZZIONPAY_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.error('VizzionPay credentials not configured');
      return res.status(500).json({ error: 'Chaves da VizzionPay não configuradas' });
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
      callbackUrl: process.env.PIX_WEBHOOK_URL || `${process.env.API_URL || 'http://localhost:3001'}/api/payments/webhook`
    };

    // Split para valores > R$10
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

    // Salvar pagamento no MySQL
    await query(
      'INSERT INTO pix_payments (admin_id, admin_name, credits, amount, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [adminId, sanitizedAdminName, credits, Math.round(amount * 100) / 100, pixData.transactionId, 'PENDING']
    );

    console.log('Pagamento PIX salvo no MySQL com transactionId:', pixData.transactionId);

    res.json({
      transactionId: pixData.transactionId,
      qrCode: pixData.pix?.code || pixData.qrCode || pixData.copyPaste,
      qrCodeBase64: pixData.pix?.base64 || pixData.qrCodeBase64,
      copyPaste: pixData.pix?.code || pixData.copyPaste || pixData.qrCode,
      amount: amount,
      dueDate: pixData.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "PENDING"
    });
  } catch (error: any) {
    console.error('Erro ao criar pagamento PIX:', error);
    res.status(500).json({ 
      error: 'Erro ao criar pagamento PIX', 
      details: error.message 
    });
  }
});

// Verificar status do pagamento
router.get('/status/:transactionId', async (req, res) => {
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

// Histórico de pagamentos
router.get('/history/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    
    const payments = await query<any[]>(
      'SELECT id, amount, credits, status, created_at, paid_at FROM pix_payments WHERE admin_id = ? ORDER BY created_at DESC LIMIT 10',
      [adminId]
    );

    res.json(payments);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Webhook de pagamento VizzionPay
router.post('/webhook', async (req, res) => {
  try {
    console.log('=== PIX WEBHOOK RECEIVED ===');
    console.log('Webhook body:', JSON.stringify(req.body, null, 2));

    const { transactionId, status, identifier } = req.body;

    // VizzionPay envia status "PAID" quando confirmado
    if (status === 'PAID' || status === 'COMPLETED') {
      const payments = await query<any[]>(
        'SELECT * FROM pix_payments WHERE transaction_id = ? AND status = ?',
        [transactionId, 'PENDING']
      );

      if (payments.length > 0) {
        const payment = payments[0];

        console.log('Processando pagamento confirmado:', payment);

        // Atualizar status do pagamento
        await query(
          'UPDATE pix_payments SET status = ?, paid_at = NOW() WHERE transaction_id = ?',
          ['PAID', transactionId]
        );

        // Adicionar créditos ao admin
        const tier = PRICE_TIERS.find(t => t.credits === payment.credits);
        if (tier) {
          await query(
            'UPDATE admins SET creditos = creditos + ? WHERE id = ?',
            [payment.credits, payment.admin_id]
          );

          await query(
            'INSERT INTO credit_transactions (to_admin_id, amount, unit_price, total_price, transaction_type) VALUES (?, ?, ?, ?, ?)',
            [payment.admin_id, payment.credits, tier.unitPrice, tier.total, 'recharge']
          );

          console.log(`Créditos adicionados: ${payment.credits} para admin ${payment.admin_id}`);
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
router.get('/goal/:year/:month', async (req, res) => {
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
router.post('/goal', async (req, res) => {
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

// Métricas de pagamentos (apenas PAID)
router.get('/metrics', async (_req, res) => {
  try {
    // Contar total de operações (todos os pagamentos)
    const allPayments = await query<any[]>('SELECT id FROM pix_payments');
    const totalOperations = allPayments.length;

    // Métricas apenas de pagamentos PAID
    const paidPayments = await query<any[]>(
      'SELECT amount, credits FROM pix_payments WHERE status = ?',
      ['PAID']
    );
    
    const totalPaidDeposits = paidPayments.length;
    const totalPaidValue = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const avgTicket = totalPaidDeposits > 0 ? totalPaidValue / totalPaidDeposits : 0;

    res.json({
      totalOperations,       // Total de operações (todos os IDs)
      totalPaidDeposits,     // Quantidade de depósitos PAID
      totalPaidValue,        // Valor total dos PAID (receita)
      avgTicket,             // Ticket médio dos PAID
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de pagamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar PIX para novo revendedor (R$90 = 5 créditos)
router.post('/create-reseller-pix', async (req, res) => {
  try {
    const { masterId, masterName, resellerData } = req.body;

    console.log('=== RESELLER PIX PAYMENT REQUEST ===');
    console.log('Request body:', { masterId, masterName, resellerData });

    const RESELLER_PRICE = 2; // R$2 (teste)
    const RESELLER_CREDITS = 5;

    // Validar input
    if (!masterId || !masterName || !resellerData) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const { nome, email, key } = resellerData;
    if (!nome || !email || !key) {
      return res.status(400).json({ error: 'Dados do revendedor incompletos' });
    }

    // Verificar se master existe
    const masters = await query<any[]>('SELECT id, nome, rank FROM admins WHERE id = ?', [masterId]);
    if (masters.length === 0 || masters[0].rank !== 'master') {
      return res.status(403).json({ error: 'Apenas masters podem criar revendedores' });
    }

    // Verificar se email já existe
    const existing = await query<any[]>('SELECT id FROM admins WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Credenciais VizzionPay
    const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
    const privateKey = process.env.VIZZIONPAY_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return res.status(500).json({ error: 'Chaves da VizzionPay não configuradas' });
    }

    const sanitizedName = masterName.replace(/[<>\"'&]/g, '').trim().substring(0, 50);
    const identifier = `RESELLER_${masterId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const pixRequest: any = {
      identifier: identifier,
      amount: RESELLER_PRICE,
      client: {
        name: sanitizedName,
        email: `admin${masterId}@sistema.com`,
        phone: "(83) 99999-9999",
        document: "05916691378"
      },
      callbackUrl: process.env.PIX_WEBHOOK_URL || `${process.env.API_URL || 'http://localhost:3001'}/api/payments/webhook-reseller`
    };

    // Split para valores > R$10
    const amountSplit = Math.round(RESELLER_PRICE * 0.05 * 100) / 100;
    pixRequest.splits = [
      {
        producerId: 'cmd80ujse00klosducwe52nkw',
        amount: amountSplit
      }
    ];

    const vizzionResponse = await fetch('https://app.vizzionpay.com/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': privateKey,
      },
      body: JSON.stringify(pixRequest),
    });

    if (!vizzionResponse.ok) {
      const errorData = await vizzionResponse.text();
      console.error('VizzionPay error:', errorData);
      throw new Error(`VizzionPay error: ${vizzionResponse.status}`);
    }

    const pixData = await vizzionResponse.json();

    if (!pixData.transactionId) {
      throw new Error('Invalid VizzionPay response');
    }

    // Salvar pagamento pendente com dados do revendedor
    await query(
      `INSERT INTO pix_payments (admin_id, admin_name, credits, amount, transaction_id, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [masterId, `RESELLER:${nome}:${email}:${key}`, RESELLER_CREDITS, RESELLER_PRICE, pixData.transactionId, 'PENDING_RESELLER']
    );

    console.log('PIX para revendedor salvo:', pixData.transactionId);

    res.json({
      transactionId: pixData.transactionId,
      qrCode: pixData.pix?.code || pixData.qrCode || pixData.copyPaste,
      qrCodeBase64: pixData.pix?.base64 || pixData.qrCodeBase64,
      copyPaste: pixData.pix?.code || pixData.copyPaste || pixData.qrCode,
      amount: RESELLER_PRICE,
      credits: RESELLER_CREDITS,
      dueDate: pixData.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "PENDING_RESELLER"
    });
  } catch (error: any) {
    console.error('Erro ao criar PIX para revendedor:', error);
    res.status(500).json({ error: 'Erro ao criar pagamento PIX', details: error.message });
  }
});

// Webhook específico para criação de revendedor
router.post('/webhook-reseller', async (req, res) => {
  try {
    console.log('=== RESELLER PIX WEBHOOK ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const { transactionId, status } = req.body;

    if (status === 'PAID' || status === 'COMPLETED') {
      const payments = await query<any[]>(
        'SELECT * FROM pix_payments WHERE transaction_id = ? AND status = ?',
        [transactionId, 'PENDING_RESELLER']
      );

      if (payments.length > 0) {
        const payment = payments[0];
        
        // Extrair dados do revendedor do admin_name
        const parts = payment.admin_name.split(':');
        if (parts[0] === 'RESELLER' && parts.length >= 4) {
          const nome = parts[1];
          const email = parts[2];
          const key = parts[3];
          const masterId = payment.admin_id;

          // Criar revendedor
          console.log(`[WEBHOOK] Criando revendedor: ${nome} (${email}) para master ${masterId}`);
          
          const result = await query<any>(
            'INSERT INTO admins (nome, email, `key`, `rank`, criado_por, creditos) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, email, key, 'revendedor', masterId, 5]
          );

          console.log(`[WEBHOOK] Revendedor criado com ID: ${result.insertId}`);

          // Registrar transação (não bloqueia se falhar)
          try {
            await query(
              `INSERT INTO credit_transactions (from_admin_id, to_admin_id, amount, total_price, transaction_type) 
               VALUES (?, ?, ?, ?, ?)`,
              [masterId, result.insertId, 5, 90, 'reseller_creation']
            );
            console.log('[WEBHOOK] Transação registrada');
          } catch (txError: any) {
            console.error('[WEBHOOK] Erro ao registrar transação:', txError.message);
          }

          // Atualizar pagamento
          await query(
            'UPDATE pix_payments SET status = ?, paid_at = NOW(), admin_name = ? WHERE transaction_id = ?',
            ['PAID', `Revendedor criado: ${nome}`, transactionId]
          );

          console.log(`Revendedor ${nome} criado com sucesso!`);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook reseller:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Verificar status do PIX de revendedor e criar se pago
router.get('/reseller-status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const payments = await query<any[]>(
      'SELECT * FROM pix_payments WHERE transaction_id = ?',
      [transactionId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    const payment = payments[0];

    // Se já foi processado
    if (payment.status === 'PAID') {
      return res.json({ status: 'PAID', message: 'Revendedor criado com sucesso!' });
    }

    // Verificar status na VizzionPay
    const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
    const privateKey = process.env.VIZZIONPAY_PRIVATE_KEY;

    if (publicKey && privateKey) {
      try {
        const vizzionResponse = await fetch(`https://app.vizzionpay.com/api/v1/gateway/pix/${transactionId}`, {
          headers: {
            'x-public-key': publicKey,
            'x-secret-key': privateKey,
          },
        });

        if (vizzionResponse.ok) {
          const vizzionData = await vizzionResponse.json();
          console.log('VizzionPay status response:', JSON.stringify(vizzionData, null, 2));
          
          // VizzionPay pode retornar status COMPLETED ou PAID
          const isPaid = vizzionData.status === 'PAID' || vizzionData.status === 'COMPLETED';
          
          if (isPaid) {
            // Processar criação do revendedor
            const parts = payment.admin_name.split(':');
            if (parts[0] === 'RESELLER' && parts.length >= 4) {
              const nome = parts[1];
              const email = parts[2];
              const key = parts[3];
              const masterId = payment.admin_id;

              // Verificar se já não foi criado
              const existing = await query<any[]>('SELECT id FROM admins WHERE email = ?', [email]);
              if (existing.length === 0) {
                console.log(`Criando revendedor: ${nome} (${email}) para master ${masterId}`);
                
                const result = await query<any>(
                  'INSERT INTO admins (nome, email, `key`, `rank`, criado_por, creditos) VALUES (?, ?, ?, ?, ?, ?)',
                  [nome, email, key, 'revendedor', masterId, 5]
                );

                console.log(`Revendedor criado com ID: ${result.insertId}`);

                try {
                  await query(
                    `INSERT INTO credit_transactions (from_admin_id, to_admin_id, amount, total_price, transaction_type) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [masterId, result.insertId, 5, 90, 'reseller_creation']
                  );
                  console.log('Transação de crédito registrada');
                } catch (txError: any) {
                  console.error('Erro ao registrar transação (pode ser AUTO_INCREMENT):', txError.message);
                  // Não bloqueia - revendedor já foi criado
                }
              } else {
                console.log(`Revendedor ${email} já existe, pulando criação`);
              }

              await query(
                'UPDATE pix_payments SET status = ?, paid_at = NOW(), admin_name = ? WHERE transaction_id = ?',
                ['PAID', `Revendedor criado: ${nome}`, transactionId]
              );

              return res.json({ status: 'PAID', message: 'Revendedor criado com sucesso!' });
            }
          }
        }
      } catch (e) {
        console.error('Erro ao verificar VizzionPay:', e);
      }
    }

    res.json({ status: payment.status });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
