const ApiError = require('../utils/ApiError');

/** Validates req.body/query/params against a zod schema map: { body, query, params }. */
module.exports = function validate(schemas) {
  return function validateMiddleware(req, res, next) {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      const details = err.errors?.map((e) => ({ field: e.path.join('.'), message: e.message }));
      next(ApiError.badRequest('Validation failed', details || err.message));
    }
  };
};
