// backend/middleware/upload.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Asegurar carpetas
const base = path.join(__dirname, '..', 'uploads');
const resumesDir = path.join(base, 'resumes');
const logosDir = path.join(base, 'logos');
[base, resumesDir, logosDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Validaciones simples
const ALLOWED_PDF = ['application/pdf'];
const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'resume') return cb(null, resumesDir);
    if (file.fieldname === 'logo') return cb(null, logosDir);
    cb(new Error('Campo de archivo inválido'));
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id || 'anon';
    const ts = Date.now();
    const ext = path.extname(file.originalname || '');
    const safe = (file.fieldname === 'resume') ? `cv_${userId}_${ts}${ext || '.pdf'}` : `logo_${userId}_${ts}${ext || ''}`;
    cb(null, safe);
  }
});

function fileFilter(req, file, cb) {
  if (file.fieldname === 'resume') {
    if (!ALLOWED_PDF.includes(file.mimetype)) return cb(new Error('Solo PDF'), false);
  }
  if (file.fieldname === 'logo') {
    if (!ALLOWED_IMG.includes(file.mimetype)) return cb(new Error('Solo imágenes (png, jpg, webp)'), false);
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Middlewares listos para usar
const uploadResume = upload.single('resume');
const uploadLogo = upload.single('logo');

module.exports = { uploadResume, uploadLogo };
