const { HttpError } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message) {
  return new HttpError(400, message);
}

function parseId(value, name = 'id') {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw badRequest(`${name} must be a positive integer`);
  }
  return Number(value);
}

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  return body;
}

function requireString(body, field, maxLength) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${field} is required and must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function requireEmail(body, field = 'email') {
  const value = requireString(body, field, 150).toLowerCase();
  if (!EMAIL_RE.test(value)) throw badRequest(`${field} must be a valid email address`);
  return value;
}

function requireNonNegativeMoney(body, field) {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw badRequest(`${field} is required and must be a number >= 0`);
  }
  if (Math.round(value * 100) / 100 !== value) {
    throw badRequest(`${field} must have at most 2 decimal places`);
  }
  return value;
}

module.exports = {
  parseId,
  requireBody,
  requireString,
  requireEmail,
  requireNonNegativeMoney,
};
