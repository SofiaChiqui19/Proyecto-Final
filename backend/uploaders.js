// backend/uploaders.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Asegurar carpetas
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

// === LOGO (ya lo usabas) ===
const logosDir = path.join(__dirname, 'uploads', 'logos');
ensureDir(logosDir);

const storageLogo = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = 'logo_' + Date.now() + ext;
    cb(null, name);
  }
});
function logoFilter(_req, file, cb) {
  const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Formato de imagen no permitido'), ok);
}
const uploadLogo = multer({ storage: storageLogo, fileFilter: logoFilter }).single('logo');

// === CV (PDF) ===
const cvDir = path.join(__dirname, 'uploads', 'cv');
ensureDir(cvDir);

const storageCV = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cvDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    const name = 'cv_' + Date.now() + ext;
    cb(null, name);
  }
});
function pdfFilter(_req, file, cb) {
  cb(file.mimetype === 'application/pdf' ? null : new Error('Solo PDF'), file.mimetype === 'application/pdf');
}
const uploadCV = multer({ storage: storageCV, fileFilter: pdfFilter }).single('cv');

module.exports = { uploadLogo, uploadCV };
