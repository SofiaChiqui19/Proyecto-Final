// backend/routes/profile.js
const r = require('express').Router();
const pool = require('../db');
const { requireRole, requireLogin } = require('../middleware/auth');
const { uploadCV } = require('../uploaders');

// Obtener mi perfil (candidato)
r.get('/users/me', requireLogin, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, bio, cv_url, role
         FROM users
        WHERE id = ? LIMIT 1`,
      [uid]
    );
    if (!rows.length) return res.status(404).json({ ok:false, msg:'No encontrado' });
    res.json({ ok:true, user: rows[0] });
  } catch (e) {
    console.error('GET /profile/users/me:', e.message);
    res.status(500).json({ ok:false, msg:'Error' });
  }
});

// Actualizar datos básicos (solo USER)
r.patch('/users/me', requireRole('USER'), async (req, res) => {
  try {
    const uid = req.session.user.id;
    const { name, phone, bio } = req.body || {};
    const fields = [], vals = [];
    if (name !== undefined) { fields.push('name = ?');  vals.push(String(name).trim()); }
    if (phone !== undefined){ fields.push('phone = ?'); vals.push(String(phone).trim()); }
    if (bio !== undefined)  { fields.push('bio = ?');   vals.push(String(bio)); }
    if (!fields.length) return res.status(400).json({ ok:false, msg:'Nada para actualizar' });
    vals.push(uid);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ ok:true, msg:'Perfil actualizado' });
  } catch (e) {
    console.error('PATCH /profile/users/me:', e.message);
    res.status(500).json({ ok:false, msg:'Error' });
  }
});

// Subir CV (PDF) (solo USER)
r.post('/users/me/cv', requireRole('USER'), uploadCV, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, msg:'Archivo CV requerido' });
    const uid = req.session.user.id;
    const rel = `/uploads/cv/${req.file.filename}`;
    await pool.execute('UPDATE users SET cv_url = ? WHERE id = ?', [rel, uid]);
    res.status(201).json({ ok:true, cv_url: rel, msg: 'CV subido' });
  } catch (e) {
    console.error('POST /profile/users/me/cv:', e.message);
    res.status(500).json({ ok:false, msg:'Error subiendo CV' });
  }
});

// Quitar CV (solo USER)
r.patch('/users/me/cv/clear', requireRole('USER'), async (req, res) => {
  try {
    const uid = req.session.user.id;
    await pool.execute('UPDATE users SET cv_url = NULL WHERE id = ?', [uid]);
    res.json({ ok:true, msg:'CV eliminado' });
  } catch (e) {
    console.error('PATCH /profile/users/me/cv/clear:', e.message);
    res.status(500).json({ ok:false, msg:'Error' });
  }
});

module.exports = r;
