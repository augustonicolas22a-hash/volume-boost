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

export default router;
