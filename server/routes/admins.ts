import { Router } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Buscar admin por ID
router.get('/:id', async (req, res) => {
  try {
    const admins = await query<any[]>(
      'SELECT id, nome, email, creditos, `rank`, profile_photo, created_at FROM admins WHERE id = ?',
      [req.params.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin não encontrado' });
    }

    res.json(admins[0]);
  } catch (error) {
    console.error('Erro ao buscar admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar revendedores de um master
router.get('/resellers/:masterId', async (req, res) => {
  try {
    const resellers = await query<any[]>(
      'SELECT id, nome, email, creditos, `rank`, profile_photo, created_at FROM admins WHERE criado_por = ?',
      [req.params.masterId]
    );

    res.json(resellers);
  } catch (error) {
    console.error('Erro ao buscar revendedores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get all masters
router.get('/masters', async (_req, res) => {
  try {
    const masters = await query<any[]>(
      'SELECT id, nome, email, creditos, created_at FROM admins WHERE `rank` = ?',
      ['master']
    );
    res.json(masters);
  } catch (error) {
    console.error('Erro ao buscar masters:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Pesquisar admins
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = `%${req.params.query}%`;
    const admins = await query<any[]>(
      'SELECT id, nome, email, creditos, `rank`, created_at FROM admins WHERE nome LIKE ? OR email LIKE ? LIMIT 20',
      [searchQuery, searchQuery]
    );

    res.json(admins);
  } catch (error) {
    console.error('Erro ao pesquisar admins:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar master
router.post('/master', async (req, res) => {
  try {
    const { nome, email, key, criadoPor } = req.body;

    const existing = await query<any[]>(
      'SELECT id FROM admins WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const result = await query<any>(
      'INSERT INTO admins (nome, email, `key`, `rank`, criado_por) VALUES (?, ?, ?, ?, ?)',
      [nome, email, key, 'master', criadoPor]
    );

    res.json({ id: result.insertId, nome, email, rank: 'master' });
  } catch (error) {
    console.error('Erro ao criar master:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar revendedor
router.post('/reseller', async (req, res) => {
  try {
    const { nome, email, key, criadoPor } = req.body;

    const existing = await query<any[]>(
      'SELECT id FROM admins WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const result = await query<any>(
      'INSERT INTO admins (nome, email, `key`, `rank`, criado_por) VALUES (?, ?, ?, ?, ?)',
      [nome, email, key, 'revendedor', criadoPor]
    );

    res.json({ id: result.insertId, nome, email, rank: 'revendedor' });
  } catch (error) {
    console.error('Erro ao criar revendedor:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar admin
router.put('/:id', async (req, res) => {
  try {
    const { nome, email, key } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (nome) {
      updates.push('nome = ?');
      values.push(nome);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (key) {
      updates.push('`key` = ?');
      values.push(key);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.id);
    await query(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar admin
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM admins WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Dashboard stats
router.get('/stats/dashboard', async (req, res) => {
  try {
    const [masters] = await query<any[]>('SELECT COUNT(*) as count FROM admins WHERE `rank` = ?', ['master']);
    const [resellers] = await query<any[]>('SELECT COUNT(*) as count FROM admins WHERE `rank` = ?', ['revendedor']);
    const [totalCredits] = await query<any[]>('SELECT SUM(creditos) as total FROM admins');

    res.json({
      totalMasters: masters?.count || 0,
      totalResellers: resellers?.count || 0,
      totalCredits: totalCredits?.total || 0
    });
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
