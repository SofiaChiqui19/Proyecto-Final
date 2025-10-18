// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const pool = require('./db'); // mysql2/promise


// Crear la aplicación Express
const app = express();

// CORS (ajusta origin si tu front corre en otro puerto)
app.use(cors({
  // origin: 'http://localhost:3000',
  // credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesión (memoria en DEV)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

// Log simple de peticiones
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// ====== MONTAR ROUTERS ======
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');          // 👈 NUEVO
const seedRoutes = require('./routes/seed');

const profileRoutes = require('./routes/profile');

const companiesRoutes = require('./routes/companies');
const usersRoutes = require('./routes/users'); // este users es el de perfil

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin', adminRoutes);                     // 👈 NUEVO (solo ADMIN)
app.use('/api/seed', seedRoutes);


// Servir archivos subidos (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/api/companies', companiesRoutes);

app.use('/api/profile', profileRoutes);



app.use('/api/companies', companiesRoutes);
app.use('/api/users', usersRoutes);


// --- RUTAS PÚBLICAS DEL FRONTEND ---

// Servir archivos estáticos del frontend (CSS, JS, imágenes, etc.)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Atajos legibles
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'register.html'));
});

app.get('/register-company', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'register-company.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

// 👇 NUEVO: panel admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

// ====== ENDPOINTS DE DIAGNÓSTICO (DEV) ======
app.get('/api/_dev/check-db', async (req, res) => {
  try {
    const [db] = await pool.query('SELECT DATABASE() AS db');
    const [cols] = await pool.query('DESCRIBE users');
    res.json({
      db_in_use: db[0]?.db,
      users_columns: cols.map(c => `${c.Field} ${c.Type}`)
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/_dev/schema', async (req, res) => {
  try {
    const [db] = await pool.query('SELECT DATABASE() AS db');
    const [tables] = await pool.query('SHOW TABLES');

    const out = { db: db[0]?.db, tables: tables.map(t => Object.values(t)[0]) };
    const describe = async (tbl) => {
      try {
        const [cols] = await pool.query(`DESCRIBE \`${tbl}\``);
        out[`desc_${tbl}`] = cols.map(c => `${c.Field} ${c.Type}`);
      } catch (e) {
        out[`desc_${tbl}`] = `ERROR: ${e.code} ${e.sqlMessage || e.message}`;
      }
    };
    for (const t of ['users', 'companies', 'jobs', 'applications']) await describe(t);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Iniciar el servidor
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// DEBUG: listar rutas (solo desarrollo)
app.get('/debug/routes', (req, res) => {
  try {
    const routes = [];
    const processLayer = (layer, prefix = '') => {
      if (!layer) return;
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        layer.handle.stack.forEach(l => processLayer(l, prefix));
      } else if (layer.regexp && layer.handle && Array.isArray(layer.handle.stack)) {
        const match = layer.regexp.toString().match(/^\/*\^\\\/(.+?)\\\//);
        const base = match ? `/${match[1]}` : '';
        layer.handle.stack.forEach(l => processLayer(l, base));
      }
    };
    if (app && app._router && Array.isArray(app._router.stack)) {
      app._router.stack.forEach(l => processLayer(l, ''));
    }
    res.json(routes);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
