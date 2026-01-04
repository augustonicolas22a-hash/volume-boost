import { Router } from 'express';
import { query, getConnection } from '../db';

const router = Router();

// Transferir créditos
router.post('/transfer', async (req, res) => {
  const connection = await getConnection();
  
  try {
    const { fromAdminId, toAdminId, amount } = req.body;

    if (!fromAdminId || !toAdminId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    await connection.beginTransaction();

    // Verificar saldo
    const [fromAdmin] = await connection.execute(
      'SELECT creditos FROM admins WHERE id = ? FOR UPDATE',
      [fromAdminId]
    );

    const balance = (fromAdmin as any[])[0]?.creditos || 0;

    if (balance < amount) {
      await connection.rollback();
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Debitar do remetente
    await connection.execute(
      'UPDATE admins SET creditos = creditos - ?, last_active = NOW() WHERE id = ?',
      [amount, fromAdminId]
    );

    // Creditar ao destinatário
    await connection.execute(
      'UPDATE admins SET creditos = creditos + ?, last_active = NOW() WHERE id = ?',
      [amount, toAdminId]
    );

    // Registrar transação
    await connection.execute(
      'INSERT INTO credit_transactions (from_admin_id, to_admin_id, amount, transaction_type) VALUES (?, ?, ?, ?)',
      [fromAdminId, toAdminId, amount, 'transfer']
    );

    await connection.commit();

    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Erro na transferência:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    connection.release();
  }
});

// Recarregar créditos
router.post('/recharge', async (req, res) => {
  try {
    const { adminId, amount, unitPrice, totalPrice } = req.body;

    await query(
      'UPDATE admins SET creditos = creditos + ?, last_active = NOW() WHERE id = ?',
      [amount, adminId]
    );

    await query(
      'INSERT INTO credit_transactions (to_admin_id, amount, unit_price, total_price, transaction_type) VALUES (?, ?, ?, ?, ?)',
      [adminId, amount, unitPrice, totalPrice, 'recharge']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro na recarga:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Histórico de transações
router.get('/transactions/:adminId', async (req, res) => {
  try {
    const transactions = await query<any[]>(
      `SELECT ct.*, 
        fa.nome as from_admin_name, 
        ta.nome as to_admin_name
      FROM credit_transactions ct
      LEFT JOIN admins fa ON ct.from_admin_id = fa.id
      LEFT JOIN admins ta ON ct.to_admin_id = ta.id
      WHERE ct.from_admin_id = ? OR ct.to_admin_id = ?
      ORDER BY ct.created_at DESC
      LIMIT 50`,
      [req.params.adminId, req.params.adminId]
    );

    res.json(transactions);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter saldo
router.get('/balance/:adminId', async (req, res) => {
  try {
    const admins = await query<any[]>(
      'SELECT creditos FROM admins WHERE id = ?',
      [req.params.adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin não encontrado' });
    }

    res.json({ credits: admins[0].creditos });
  } catch (error) {
    console.error('Erro ao buscar saldo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Receita mensal
router.get('/revenue/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;

    const result = await query<any[]>(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM credit_transactions
      WHERE transaction_type = 'recharge'
      AND YEAR(created_at) = ?
      AND MONTH(created_at) = ?`,
      [year, month]
    );

    res.json({ revenue: result[0]?.revenue || 0 });
  } catch (error) {
    console.error('Erro ao buscar receita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get all transactions
router.get('/transactions/all', async (_req, res) => {
  try {
    const transactions = await query<any[]>(
      `SELECT ct.*, fa.nome as from_admin_name, ta.nome as to_admin_name
      FROM credit_transactions ct
      LEFT JOIN admins fa ON ct.from_admin_id = fa.id
      LEFT JOIN admins ta ON ct.to_admin_id = ta.id
      ORDER BY ct.created_at DESC LIMIT 100`
    );
    res.json(transactions);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get metrics (depósitos de pix_payments PAID + transferências de credit_transactions)
router.get('/metrics', async (_req, res) => {
  try {
    // Métricas de pagamentos PIX (apenas PAID)
    const paidPayments = await query<any[]>(
      'SELECT amount FROM pix_payments WHERE status = ?',
      ['PAID']
    );
    const totalDeposits = paidPayments.length;
    const totalDepositValue = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const avgTicket = totalDeposits > 0 ? totalDepositValue / totalDeposits : 0;

    // Métricas de transferências
    const transfers = await query<any[]>(
      'SELECT amount FROM credit_transactions WHERE transaction_type = ?',
      ['transfer']
    );
    const totalTransfers = transfers.length;
    const totalTransferCredits = transfers.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    res.json({
      totalDeposits,
      totalDepositValue,
      totalTransfers,
      totalTransferCredits,
      avgTicket,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get monthly data
router.get('/monthly-data', async (_req, res) => {
  try {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartData.push({ month: months[d.getMonth()], deposits: 0, transfers: 0 });
    }
    res.json(chartData);
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Métricas específicas de um Master (transferências para seus revendedores)
router.get('/master-metrics/:masterId', async (req, res) => {
  try {
    const { masterId } = req.params;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Total de créditos transferidos pelo master (para seus revendedores)
    const transfersTotal = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as total_transferred, COUNT(*) as total_transfers
       FROM credit_transactions 
       WHERE from_admin_id = ? AND transaction_type = 'transfer'`,
      [masterId]
    );

    // Transferências do mês atual
    const transfersMonth = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as month_transferred, COUNT(*) as month_transfers
       FROM credit_transactions 
       WHERE from_admin_id = ? AND transaction_type = 'transfer'
       AND MONTH(created_at) = ? AND YEAR(created_at) = ?`,
      [masterId, currentMonth, currentYear]
    );

    // Total de recargas do master (quanto ele recarregou de créditos)
    const rechargesTotal = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as total_recharged, COALESCE(SUM(total_price), 0) as total_spent
       FROM credit_transactions 
       WHERE to_admin_id = ? AND transaction_type = 'recharge'`,
      [masterId]
    );

    // Recargas do mês
    const rechargesMonth = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as month_recharged, COALESCE(SUM(total_price), 0) as month_spent
       FROM credit_transactions 
       WHERE to_admin_id = ? AND transaction_type = 'recharge'
       AND MONTH(created_at) = ? AND YEAR(created_at) = ?`,
      [masterId, currentMonth, currentYear]
    );

    // Meta do master para o mês (usar monthly_goals se existir)
    const masterGoal = await query<any[]>(
      `SELECT target_revenue FROM monthly_goals 
       WHERE year = ? AND month = ?`,
      [currentYear, currentMonth]
    );

    // Total de revendedores do master
    const resellersCount = await query<any[]>(
      `SELECT COUNT(*) as count FROM admins WHERE criado_por = ? AND rank = 'revendedor'`,
      [masterId]
    );

    // Lucro estimado (transferências x R$20 mínimo por crédito - custo)
    const totalTransferred = Number(transfersTotal[0]?.total_transferred) || 0;
    const totalSpent = Number(rechargesTotal[0]?.total_spent) || 0;
    const estimatedRevenue = totalTransferred * 20; // R$20 mínimo por crédito vendido
    const estimatedProfit = estimatedRevenue - totalSpent;

    res.json({
      totalTransferred,
      totalTransfers: Number(transfersTotal[0]?.total_transfers) || 0,
      monthTransferred: Number(transfersMonth[0]?.month_transferred) || 0,
      monthTransfers: Number(transfersMonth[0]?.month_transfers) || 0,
      totalRecharged: Number(rechargesTotal[0]?.total_recharged) || 0,
      totalSpent,
      monthRecharged: Number(rechargesMonth[0]?.month_recharged) || 0,
      monthSpent: Number(rechargesMonth[0]?.month_spent) || 0,
      monthlyGoal: Number(masterGoal[0]?.target_revenue) || 0,
      totalResellers: Number(resellersCount[0]?.count) || 0,
      estimatedRevenue,
      estimatedProfit,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas do master:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Histórico de transferências de um master para seus revendedores
router.get('/master-transfers/:masterId', async (req, res) => {
  try {
    const { masterId } = req.params;
    
    const transfers = await query<any[]>(
      `SELECT ct.id, ct.amount, ct.created_at, 
              ta.nome as reseller_name, ta.email as reseller_email
       FROM credit_transactions ct
       JOIN admins ta ON ct.to_admin_id = ta.id
       WHERE ct.from_admin_id = ? AND ct.transaction_type = 'transfer'
       ORDER BY ct.created_at DESC
       LIMIT 100`,
      [masterId]
    );

    res.json(transfers);
  } catch (error) {
    console.error('Erro ao buscar transferências do master:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar/criar meta do master
router.post('/master-goal', async (req, res) => {
  try {
    const { masterId, year, month, targetRevenue } = req.body;

    // Verificar se já existe uma meta para este mês
    const existing = await query<any[]>(
      'SELECT id FROM monthly_goals WHERE year = ? AND month = ?',
      [year, month]
    );

    if (existing.length > 0) {
      await query(
        'UPDATE monthly_goals SET target_revenue = ?, updated_at = NOW() WHERE year = ? AND month = ?',
        [targetRevenue, year, month]
      );
    } else {
      await query(
        'INSERT INTO monthly_goals (year, month, target_revenue) VALUES (?, ?, ?)',
        [year, month, targetRevenue]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
