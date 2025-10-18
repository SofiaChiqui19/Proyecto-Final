// backend/routes/jobs.js
const router = require('express').Router();
const pool = require('../db'); // mysql2/promise
const { requireRole } = require('../middleware/auth');

/** Helpers */
function normalizeSalary(s) {
  if (s === undefined || s === null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/jobs
 * Crea un empleo (solo EMPLOYER)
 * Body: { title, description, salary? }
 */
router.post('/', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const salary = normalizeSalary(req.body?.salary);
    if (!title || !description) {
      return res.status(400).json({ ok: false, msg: 'title y description son obligatorios' });
    }

    // empresa del employer logueado
    const userId = req.session.user.id;
    const [companyRows] = await pool.execute(
      'SELECT id FROM companies WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const company = companyRows[0];
    if (!company) {
      return res.status(400).json({ ok: false, msg: 'No se encontró empresa para este usuario' });
    }

    const [ins] = await pool.execute(
      `INSERT INTO jobs (company_id, title, description, salary)
       VALUES (?, ?, ?, ?)`,
      [company.id, title.trim(), description.trim(), salary]
    );

    res.status(201).json({
      ok: true,
      job: { id: ins.insertId, title: title.trim(), description: description.trim(), salary }
    });
  } catch (err) {
    console.error('POST /api/jobs error:', err.code, err.sqlMessage || err.message);
    res.status(500).json({ ok: false, msg: 'Error al crear empleo' });
  }
});

/**
 * GET /api/jobs/mine
 * Empleos publicados por mi empresa (solo EMPLOYER)
 */
router.get('/mine', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.description, j.salary, j.created_at
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE c.user_id = ?
        ORDER BY j.created_at DESC`,
      [userId]
    );
    res.json({ ok: true, jobs: rows });
  } catch (err) {
    console.error('GET /api/jobs/mine error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error listando empleos' });
  }
});

/**
 * GET /api/jobs
 * Listado público (ARRAY plano, para frontend actual)
 * Query opcional: limit, offset
 * 👉 Incluye logo de la empresa (c.logo_url AS logo)
 */
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit  || '50', 10), 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);

    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.description, j.salary, j.created_at,
              c.name AS company, c.location AS location, c.logo_url AS logo
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        ORDER BY j.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`
    );
    // Por compatibilidad devolvemos directamente el array (tu main.js ya tolera ambas formas)
    res.json(rows);
  } catch (err) {
    console.error('GET /api/jobs error:', err.message);
    res.status(500).json({ error: 'Error al obtener los empleos' });
  }
});

/**
 * GET /api/jobs/search
 * Búsqueda + paginación (objeto con metadata)
 * Query: q, limit, offset
 * 👉 Incluye logo
 */
router.get('/search', async (req, res) => {
  try {
    const q      = (req.query.q || '').trim();
    const limit  = Math.min(Math.max(parseInt(req.query.limit  || '50', 10), 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);

    const params = [];
    let where = '';
    if (q) {
      where = `WHERE (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.description, j.salary, j.created_at,
              c.name AS company, c.location AS location, c.logo_url AS logo
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        ${where}
        ORDER BY j.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ ok: true, jobs: rows, pagination: { limit, offset, count: rows.length } });
  } catch (err) {
    console.error('GET /api/jobs/search error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error en búsqueda de empleos' });
  }
});

/**
 * GET /api/jobs/:id
 * Detalle público de un empleo (👉 incluye logo y website)
 */
router.get('/:id', async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT j.id, j.title, j.description, j.salary, j.created_at,
              c.id AS company_id, c.name AS company, c.location,
              c.logo_url AS logo, c.website AS website
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE j.id = ?
        LIMIT 1`,
      [jobId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Empleo no encontrado' });
    res.json({ ok: true, job: rows[0] });
  } catch (err) {
    console.error('GET /api/jobs/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error al obtener empleo' });
  }
});

/**
 * PUT /api/jobs/:id
 * Actualiza un empleo (solo EMPLOYER dueño)
 */
router.put('/:id', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const { title, description } = req.body || {};
    const salary = normalizeSalary(req.body?.salary);
    if (!title || !description) {
      return res.status(400).json({ ok: false, msg: 'title y description son obligatorios' });
    }

    // comprobar ownership
    const employerId = req.session.user.id;
    const [own] = await pool.execute(
      `SELECT j.id
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND c.user_id = ?
        LIMIT 1`,
      [jobId, employerId]
    );
    if (!own.length) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    await pool.execute(
      `UPDATE jobs
          SET title = ?, description = ?, salary = ?
        WHERE id = ?`,
      [title.trim(), description.trim(), salary, jobId]
    );

    res.json({ ok: true, msg: 'Empleo actualizado' });
  } catch (err) {
    console.error('PUT /api/jobs/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error actualizando empleo' });
  }
});

/**
 * PATCH /api/jobs/:id
 * Actualización parcial (solo EMPLOYER dueño)
 * Body puede incluir: { title?, description?, salary? }
 */
router.patch('/:id', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const employerId = req.session.user.id;

    // comprobar ownership
    const [own] = await pool.execute(
      `SELECT j.id
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND c.user_id = ?
        LIMIT 1`,
      [jobId, employerId]
    );
    if (!own.length) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    const fields = [];
    const values = [];

    if (req.body?.title)       { fields.push('title = ?');       values.push(String(req.body.title).trim()); }
    if (req.body?.description) { fields.push('description = ?'); values.push(String(req.body.description).trim()); }
    if (req.body?.salary !== undefined) {
      fields.push('salary = ?'); values.push(normalizeSalary(req.body.salary));
    }

    if (!fields.length) return res.status(400).json({ ok: false, msg: 'No hay campos para actualizar' });

    values.push(jobId);
    await pool.execute(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ ok: true, msg: 'Empleo actualizado' });
  } catch (err) {
    console.error('PATCH /api/jobs/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error actualizando empleo' });
  }
});

/**
 * DELETE /api/jobs/:id
 * Elimina un empleo (solo EMPLOYER dueño)
 */
router.delete('/:id', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const employerId = req.session.user.id;

    // comprobar ownership
    const [own] = await pool.execute(
      `SELECT j.id
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND c.user_id = ?
        LIMIT 1`,
      [jobId, employerId]
    );
    if (!own.length) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    await pool.execute('DELETE FROM jobs WHERE id = ?', [jobId]);
    res.json({ ok: true, msg: 'Empleo eliminado' });
  } catch (err) {
    console.error('DELETE /api/jobs/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error eliminando empleo' });
  }
});

module.exports = router;
