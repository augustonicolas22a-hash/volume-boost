import { Router } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, key } = req.body;

    if (!email || !key) {
      return res.status(400).json({ error: 'Email e chave são obrigatórios' });
    }

    const admins = await query<any[]>(
      'SELECT id, nome, email, creditos, `rank`, profile_photo, pin, criado_por FROM admins WHERE email = ? AND `key` = ?',
      [email, key]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const admin = admins[0];
    const sessionToken = uuidv4();

    await query(
      'UPDATE admins SET session_token = ?, last_active = NOW(), ip_address = ? WHERE id = ?',
      [sessionToken, req.ip, admin.id]
    );

    res.json({
      admin: { 
        ...admin, 
        session_token: sessionToken,
        has_pin: admin.pin ? true : false
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Validar PIN
router.post('/validate-pin', async (req, res) => {
  try {
    const { adminId, pin } = req.body;

    const result = await query<any[]>(
      'SELECT pin FROM admins WHERE id = ?',
      [adminId]
    );

    if (result.length === 0) {
      return res.json({ valid: false });
    }

    const storedPin = result[0].pin;
    
    // Comparar PIN (suporta texto plano por enquanto)
    const valid = storedPin === pin;

    res.json({ valid });
  } catch (error) {
    console.error('Erro ao validar PIN:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Definir PIN
router.post('/set-pin', async (req, res) => {
  try {
    const { adminId, pin } = req.body;

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN deve ter 4 dígitos numéricos' });
    }

    await query('UPDATE admins SET pin = ? WHERE id = ?', [pin, adminId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao definir PIN:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Validar sessão
router.post('/validate-session', async (req, res) => {
  try {
    const { adminId, sessionToken } = req.body;

    const result = await query<any[]>(
      'SELECT 1 FROM admins WHERE id = ? AND session_token = ?',
      [adminId, sessionToken]
    );

    if (result.length > 0) {
      // Atualizar last_active
      await query('UPDATE admins SET last_active = NOW() WHERE id = ?', [adminId]);
    }

    res.json({ valid: result.length > 0 });
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { adminId } = req.body;

    await query('UPDATE admins SET session_token = NULL WHERE id = ?', [adminId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
