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
      const debugEnabled = process.env.AUTH_DEBUG === 'true';
      return res.status(401).json({
        error: 'Credenciais inválidas',
        ...(debugEnabled ? { debug: { emailFound: false } } : {}),
      });
    }

    const admin = admins[0];

    const providedKey = String(key).trim();
    const storedKeyRaw = String((admin as any).stored_key ?? '').trim();

    // Normalizar hashes bcrypt gerados por outras libs (ex: PHP usa $2y$)
    const storedKeyNormalized = storedKeyRaw.startsWith('$2y$')
      ? storedKeyRaw.replace('$2y$', '$2a$')
      : storedKeyRaw;

    const looksBcrypt = storedKeyRaw.startsWith('$2a$') || storedKeyRaw.startsWith('$2b$') || storedKeyRaw.startsWith('$2y$');

    let bcryptMatch = false;
    let bcryptError: unknown = null;

    if (looksBcrypt) {
      try {
        // Tenta com o hash normalizado; se falhar, tenta com o original
        bcryptMatch = await bcrypt.compare(providedKey, storedKeyNormalized);
        if (!bcryptMatch && storedKeyNormalized !== storedKeyRaw) {
          bcryptMatch = await bcrypt.compare(providedKey, storedKeyRaw);
        }
      } catch (err) {
        bcryptError = err;
      }
    }

    const plainMatch = providedKey === storedKeyRaw;
    const match = looksBcrypt ? bcryptMatch : plainMatch;

    // Debug (não loga a chave; só metadados)
    console.log('[AUTH] login tentativa', {
      email,
      providedLen: providedKey.length,
      storedLen: storedKeyRaw.length,
      hashPrefix: storedKeyRaw.slice(0, 4),
      hashPrefixNormalized: storedKeyNormalized.slice(0, 4),
      looksBcrypt,
      bcryptMatch,
      plainMatch,
      bcryptError: bcryptError ? String(bcryptError) : null,
      match,
    });

    if (!match) {
      const debugEnabled = process.env.AUTH_DEBUG === 'true';
      return res.status(401).json({
        error: 'Credenciais inválidas',
        ...(debugEnabled
          ? {
              debug: {
                emailFound: true,
                looksBcrypt,
                hashPrefix: storedKeyRaw.slice(0, 4),
                bcryptMatch,
                plainMatch,
                bcryptError: bcryptError ? String(bcryptError) : null,
              },
            }
          : {}),
      });
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

// Debug: testar comparação bcrypt (SÓ quando AUTH_DEBUG=true)
router.post('/debug-compare', async (req, res) => {
  if (process.env.AUTH_DEBUG !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { plain, hash } = req.body as { plain?: string; hash?: string };
  const plainStr = String(plain ?? '');
  const hashRaw = String(hash ?? '');
  const hashNormalized = hashRaw.startsWith('$2y$') ? hashRaw.replace('$2y$', '$2a$') : hashRaw;

  try {
    const matchNormalized = await bcrypt.compare(plainStr, hashNormalized);
    const matchRaw = hashRaw === hashNormalized ? matchNormalized : await bcrypt.compare(plainStr, hashRaw);

    return res.json({
      ok: true,
      plainLen: plainStr.length,
      hashPrefix: hashRaw.slice(0, 4),
      hashPrefixNormalized: hashNormalized.slice(0, 4),
      matchNormalized,
      matchRaw,
    });
  } catch (e) {
    return res.json({ ok: false, error: String(e) });
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
    const storedPinRaw = String(storedPin ?? '').trim();

    const storedPinNormalized = storedPinRaw.startsWith('$2y$')
      ? storedPinRaw.replace('$2y$', '$2a$')
      : storedPinRaw;

    const looksBcrypt = storedPinRaw.startsWith('$2a$') || storedPinRaw.startsWith('$2b$') || storedPinRaw.startsWith('$2y$');

    let bcryptMatch = false;
    let bcryptError: unknown = null;

    if (looksBcrypt) {
      try {
        bcryptMatch = await bcrypt.compare(providedPin, storedPinNormalized);
        if (!bcryptMatch && storedPinNormalized !== storedPinRaw) {
          bcryptMatch = await bcrypt.compare(providedPin, storedPinRaw);
        }
      } catch (err) {
        bcryptError = err;
      }
    }

    const plainMatch = storedPinRaw === providedPin;
    const valid = looksBcrypt ? bcryptMatch : plainMatch;

    console.log('[AUTH] validate-pin', {
      adminId,
      providedLen: providedPin.length,
      storedLen: storedPinRaw.length,
      hashPrefix: storedPinRaw.slice(0, 4),
      hashPrefixNormalized: storedPinNormalized.slice(0, 4),
      looksBcrypt,
      bcryptMatch,
      plainMatch,
      bcryptError: bcryptError ? String(bcryptError) : null,
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
