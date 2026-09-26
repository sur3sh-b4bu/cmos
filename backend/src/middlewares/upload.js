const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const CHURCH_LOGO_DIR = path.join(UPLOAD_ROOT, 'church-logos');

// SVG deliberately excluded: it's an XML document that can carry an
// embedded <script> or event-handler attribute, so accepting one as a
// "logo image" upload is a stored-content risk if this file is ever
// rendered outside an <img> tag (which alone doesn't execute embedded
// script, but a direct navigation or an <object>/<iframe> embed would).
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const churchLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(CHURCH_LOGO_DIR, { recursive: true });
    cb(null, CHURCH_LOGO_DIR);
  },
  // Trusts the sniffed mimetype for the extension rather than the client-
  // supplied original filename, which is untrusted input.
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `church-${req.params.id}-${Date.now()}${ext}`);
  },
});

/** Single 'logo' field, image-only, 2MB cap -- errors surface as ApiError so
 * the standard errorHandler formats them the same as any other 400. */
const churchLogoUpload = multer({
  storage: churchLogoStorage,
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest('Logo must be a PNG, JPEG or WEBP image'));
    }
    cb(null, true);
  },
}).single('logo');

module.exports = { churchLogoUpload, UPLOAD_ROOT, CHURCH_LOGO_DIR };
