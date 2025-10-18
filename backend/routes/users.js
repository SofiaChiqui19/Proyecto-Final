// backend/routes/users.js
const r = require('express').Router();
const pool = require('../db'); // mysql2/promise
const { requireLogin, requireRole } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');

// GET /api/users/me -> datos del usuario logueado (USER o EMPLOYER)
r.get('/me', requireLogin, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, resume_url FROM users WHERE id = ? LIMIT 1',
      [uid]
    );
    if (!rows.length) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });
    res.json({ ok:true, user: rows[0] });
  } catch (e) {
    console.error('GET /users/me', e);
    res.status(500).json({ ok:false, msg:'Error al obtener usuario' });
  }
});

// PATCH /api/users/me -> actualizar nombre (solo USER edita su nombre aquí)
r.patch('/me', requireRole('USER'), async (req, res) => {
  try {
    const uid = req.session.user.id;
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ ok:false, msg:'El nombre es obligatorio' });

    await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, uid]);
    // refrescar sesión
    req.session.user.name = name;
    res.json({ ok:true, msg:'Perfil actualizado' });
  } catch (e) {
    console.error('PATCH /users/me', e);
    res.status(500).json({ ok:false, msg:'Error al actualizar perfil' });
  }
});

// POST /api/users/me/resume -> subir CV PDF
r.post('/me/resume', requireRole('USER'), (req, res, next) => {
  uploadResume(req, res, async (err) => {
    if (err) {
      console.error('upload resume error:', err.message);
      return res.status(400).json({ ok:false, msg: err.message || 'Archivo inválido' });
    }
    if (!req.file) return res.status(400).json({ ok:false, msg:'No se adjuntó archivo' });

    try {
      const uid = req.session.user.id;
      const url = `/uploads/resumes/${req.file.filename}`;
      await pool.execute('UPDATE users SET resume_url = ? WHERE id = ?', [url, uid]);
      res.json({ ok:true, msg:'CV subido', resume_url: url });
    } catch (e2) {
      console.error('save resume url error:', e2);
      res.status(500).json({ ok:false, msg:'Error guardando CV' });
    }
  });
});

module.exports = r;
