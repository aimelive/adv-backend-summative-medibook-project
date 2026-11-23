const patientModel = require('../models/patientModel');
const { HttpError } = require('../middleware/errorHandler');
const { parseId, requireBody, requireString, requireEmail } = require('../utils/validators');

function parsePatient(body) {
  requireBody(body);
  return {
    full_name: requireString(body, 'full_name', 100),
    email: requireEmail(body),
    phone: requireString(body, 'phone', 20),
  };
}

async function getOrFail(id) {
  const patient = await patientModel.findById(id);
  if (!patient) throw new HttpError(404, `Patient ${id} not found`);
  return patient;
}

async function list(req, res) {
  res.json(await patientModel.findAll());
}

async function get(req, res) {
  res.json(await getOrFail(parseId(req.params.id)));
}

async function create(req, res) {
  const data = parsePatient(req.body);
  const id = await patientModel.create(data);
  res.status(201).json(await patientModel.findById(id));
}

async function update(req, res) {
  const id = parseId(req.params.id);
  const data = parsePatient(req.body);
  await getOrFail(id);
  await patientModel.update(id, data);
  res.json(await patientModel.findById(id));
}

async function remove(req, res) {
  const id = parseId(req.params.id);
  await getOrFail(id);
  await patientModel.remove(id);
  res.status(204).end();
}

module.exports = { list, get, create, update, remove };
