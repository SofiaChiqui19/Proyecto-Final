// backend/routes/companies.js
const r = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { uploadLogo } = require('../middleware/upload');

// GET /api/companies/me -> datos de la empresa del EMPLOYER
r.get('/me', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const uid = req.session.user.id;
    const [rows] = await pool.execute(
      'SELECT id, user_id, name, nit, website, location, logo_url FROM companies WHERE user_id = ? LIMIT 1',
      [uid]
    );
    if (!rows.length) return res.status(404).json({ ok:false, msg:'No tienes empresa asociada' });
    res.json({ ok:true, company: rows[0] });
  } catch (e) {
    console.error('GET /companies/me', e);
    res.status(500).json({ ok:false, msg:'Error' });
  }
});

// PATCH /api/companies/me -> actualizar campos básicos
r.patch('/me', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const uid = req.session.user.id;
    const { name, nit, website, location } = req.body || {};
    const fields = [];
    const values = [];
    if (name !== undefined)     { fields.push('name = ?');     values.push(String(name).trim()); }
    if (nit !== undefined)      { fields.push('nit = ?');      values.push(String(nit).trim()); }
    if (website !== undefined)  { fields.push('website = ?');  values.push(String(website).trim()); }
    if (location !== undefined) { fields.push('location = ?'); values.push(String(location).trim()); }
    if (!fields.length) return res.status(400).json({ ok:false, msg:'Sin cambios' });

    values.push(uid);
    await pool.execute(`UPDATE companies SET ${fields.join(', ')} WHERE user_id = ?`, values);
    res.json({ ok:true, msg:'Empresa actualizada' });
  } catch (e) {
    console.error('PATCH /companies/me', e);
    res.status(500).json({ ok:false, msg:'Error al actualizar empresa' });
  }
});

// POST /api/companies/me/logo -> subir logo imagen
r.post('/me/logo', requireRole('EMPLOYER'), (req, res, next) => {
  uploadLogo(req, res, async (err) => {
    if (err) {
      console.error('upload logo error:', err.message);
      return res.status(400).json({ ok:false, msg: err.message || 'Archivo inválido' });
    }
    if (!req.file) return res.status(400).json({ ok:false, msg:'No se adjuntó archivo' });

    try {
      const uid = req.session.user.id;
      const url = `/uploads/logos/${req.file.filename}`;
      await pool.execute('UPDATE companies SET logo_url = ? WHERE user_id = ?', [url, uid]);
      res.json({ ok:true, msg:'Logo subido', logo_url: url });
    } catch (e2) {
      console.error('save logo url error:', e2);
      res.status(500).json({ ok:false, msg:'Error guardando logo' });
    }
  });
});

module.exports = r;
