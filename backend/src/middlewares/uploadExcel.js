'use strict';

const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { DEFAULT_MAX_BYTES } = require('../excel/workbookReader');

/**
 * In-memory single-file upload for Excel imports (field name "file").
 * Nothing is written to disk: the workbook is parsed straight from the
 * buffer and discarded. The size cap is enforced here (cheaply, before any
 * parsing) and again inside the reader, which also checks the file's real
 * content and .xlsx extension rather than trusting the client.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_MAX_BYTES, files: 1 },
});

const single = upload.single('file');

function uploadExcel(req, res, next) {
  single(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = (DEFAULT_MAX_BYTES / (1024 * 1024)).toFixed(0);
        return next(ApiError.badRequest(`The file is too large. The maximum size is ${mb} MB.`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return next(ApiError.badRequest('Upload exactly one .xlsx file.'));
      }
      return next(err);
    }
    if (!req.file) return next(ApiError.badRequest('No file was uploaded. Choose an .xlsx file.'));
    return next();
  });
}

module.exports = uploadExcel;
