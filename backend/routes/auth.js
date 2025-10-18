// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');        // mysql2/promise
const bcrypt = require('bcrypt');

const path = require('path');
const fs = require('fs');
const multer = require('multer');

/* ========= MULTER: subida de logo de empresa ========= */
const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    cb(null, safe);
  },
});
const fileFilter = (_req, file, cb) => {
  const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
  cb(ok ? null : new Error('Tipo de archivo no permitido'), ok);
};
const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single('logo'); // <input name="logo">

/* ======================
 * Registro de USUARIO (ROLE: USER)
 * ====================== */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  try {
    const [exists] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "USER")',
      [name, email, hashed]
    );

    req.session.user = { id: result.insertId, name, role: 'USER' };
    res.json({ message: 'Usuario registrado', userId: result.insertId, role: 'USER' });
  } catch (err) {
    console.error('register USER error:', err);
    res.status(500).json({ error: 'Error registrando usuario' });
  }
});

/* ======================
 * Login (USER o EMPLOYER)
 * ====================== */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ message: 'Login correcto', user: req.session.user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/* =============
 * Logout
 * ============= */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Sesión cerrada' });
  });
});

/* ==========================================
 * Registrar EMPRESA (ROLE: EMPLOYER) + company + logo
 * Recibe multipart/form-data:
 *  - email, password, name (representante)
 *  - company_name, company_nit, company_website, company_location
 *  - logo (file)
 * ========================================== */
router.post('/register-company', (req, res) => {
  // Primero procesamos el multipart (multer)
  uploadLogo(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('multer error:', uploadErr.message);
      return res.status(400).json({ error: uploadErr.message || 'Archivo inválido' });
    }

    const conn = await pool.getConnection();
    try {
      const email        = (req.body.email || '').trim();
      const password     = req.body.password || '';
      const repName      = (req.body.name || '').trim(); // representante
      const companyName  = (req.body.company_name || '').trim();
      const nit          = (req.body.company_nit || '').trim() || null;
      const website      = (req.body.company_website || '').trim() || null;
      const location     = (req.body.company_location || '').trim() || null;

      if (!email || !password || !companyName) {
        return res.status(400).json({ error: 'email, password y company_name son obligatorios' });
      }

      const [exists] = await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

      await conn.beginTransaction();

      const hashed = await bcrypt.hash(password, 10);

      // 1) crear USER con rol EMPLOYER
      const [uRes] = await conn.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?,?,?, "EMPLOYER")',
        [repName || companyName, email, hashed]
      );
      const userId = uRes.insertId;

      // 2) construir URL del logo (si se subió)
      let logoUrl = null;
      if (req.file) {
        logoUrl = '/uploads/logos/' + req.file.filename;
      }

      // 3) crear COMPANY 1:1
      await conn.execute(
        'INSERT INTO companies (user_id, name, nit, website, location, logo_url) VALUES (?,?,?,?,?,?)',
        [userId, companyName, nit, website, location, logoUrl]
      );

      await conn.commit();

      req.session.user = { id: userId, name: repName || companyName, role: 'EMPLOYER' };
      res.status(201).json({ message: 'Empresa registrada', userId, role: 'EMPLOYER', logo_url: logoUrl });
    } catch (err) {
      try { await conn.rollback(); } catch {}
      console.error('register-company error:', err.code, err.sqlMessage || err.message);
      res.status(500).json({ error: 'Error registrando empresa' });
    } finally {
      conn.release();
    }
  });
});

/* ======================
 * Quién está logueado (debug)
 * ====================== */
router.get('/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

module.exports = router;
