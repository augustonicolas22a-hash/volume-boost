import { Router } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, key } = req.body;

    if (!email || !key) {
      return res.status(400).json({ error: 'Email e chave são obrigatórios' });
    }

    // Buscar por email e comparar a chave em código (suporta valores com espaços / tipos diferentes)
    const admins = await query<any[]>(
      'SELECT id, nome, email, creditos, `rank`, profile_photo, pin, criado_por, `key` as stored_key FROM admins WHERE email = ? LIMIT 1',
      [email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const admin = admins[0];

    const providedKey = String(key).trim();
    let storedKey = String((admin as any).stored_key ?? '').trim();

    // Converter $2y$ (PHP) para $2a$ (compatível com bcryptjs)
    if (storedKey.startsWith('$2y$')) {
      storedKey = storedKey.replace('$2y$', '$2a$');
    }

    const isBcryptHash = storedKey.startsWith('$2a$') || storedKey.startsWith('$2b$');
    const match = isBcryptHash ? await bcrypt.compare(providedKey, storedKey) : providedKey === storedKey;

    // Debug (não loga a chave em si)
    console.log('[AUTH] login tentativa', {
      email,
      providedLen: providedKey.length,
      storedLen: storedKey.length,
      bcrypt: isBcryptHash,
      match,
    });

    if (!match) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const sessionToken = uuidv4();

    await query(
      'UPDATE admins SET session_token = ?, last_active = NOW(), ip_address = ? WHERE id = ?',
      [sessionToken, req.ip, admin.id]
    );

    // Não retornar stored_key
    delete (admin as any).stored_key;

    res.json({
      admin: {
        ...admin,
        session_token: sessionToken,
        has_pin: admin.pin ? true : false,
      },
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
      'SELECT pin FROM admins WHERE id = ? LIMIT 1',
      [adminId]
    );

    if (result.length === 0) {
      return res.json({ valid: false });
    }

    const storedPin = result[0].pin;

    const providedPin = String(pin ?? '').trim();
    let storedPinStr = String(storedPin ?? '').trim();

    // Converter $2y$ (PHP) para $2a$ (compatível com bcryptjs)
    if (storedPinStr.startsWith('$2y$')) {
      storedPinStr = storedPinStr.replace('$2y$', '$2a$');
    }

    const isBcryptHash = storedPinStr.startsWith('$2a$') || storedPinStr.startsWith('$2b$');
    const valid = isBcryptHash ? await bcrypt.compare(providedPin, storedPinStr) : storedPinStr === providedPin;

    console.log('[AUTH] validate-pin', {
      adminId,
      providedLen: providedPin.length,
      storedLen: storedPinStr.length,
      bcrypt: isBcryptHash,
      valid,
    });

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

    const pinHash = await bcrypt.hash(pin, 10);
    await query('UPDATE admins SET pin = ? WHERE id = ?', [pinHash, adminId]);

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
