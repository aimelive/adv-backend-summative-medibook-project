class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Single place where MySQL / body-parser errors become HTTP errors.
function mapKnownError(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new HttpError(409, 'A record with this unique value (e.g. email) already exists');
    case 'ER_ROW_IS_REFERENCED_2':
      return new HttpError(409, 'Cannot delete: this record still has appointments');
    case 'ER_NO_REFERENCED_ROW_2':
      return new HttpError(404, 'Referenced patient or doctor does not exist');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new HttpError(400, 'Value violates a database constraint');
    default:
      break;
  }
  if (err.type === 'entity.parse.failed') return new HttpError(400, 'Malformed JSON body');
  return null;
}

function errorHandler(err, req, res, next) {
  const mapped = err instanceof HttpError ? err : mapKnownError(err);
  if (mapped) {
    return res.status(mapped.status).json({ error: mapped.message, ...mapped.details });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, notFound, errorHandler };
