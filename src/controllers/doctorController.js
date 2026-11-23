const doctorModel = require('../models/doctorModel');
const { MAX_APPOINTMENTS_PER_DAY, STATS_WINDOW_DAYS } = require('../config/constants');
const { HttpError } = require('../middleware/errorHandler');
const {
  parseId,
  requireBody,
  requireString,
  requireNonNegativeMoney,
} = require('../utils/validators');

function parseDoctor(body) {
  requireBody(body);
  return {
    full_name: requireString(body, 'full_name', 100),
    specialty: requireString(body, 'specialty', 100),
    consultation_fee: requireNonNegativeMoney(body, 'consultation_fee'),
    room: requireString(body, 'room', 10),
  };
}

async function getOrFail(id) {
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw new HttpError(404, `Doctor ${id} not found`);
  return doctor;
}

async function list(req, res) {
  res.json(await doctorModel.findAll());
}

async function get(req, res) {
  res.json(await getOrFail(parseId(req.params.id)));
}

async function create(req, res) {
  const data = parseDoctor(req.body);
  const id = await doctorModel.create(data);
  res.status(201).json(await doctorModel.findById(id));
}

async function update(req, res) {
  const id = parseId(req.params.id);
  const data = parseDoctor(req.body);
  await getOrFail(id);
  await doctorModel.update(id, data);
  res.json(await doctorModel.findById(id));
}

async function remove(req, res) {
  const id = parseId(req.params.id);
  await getOrFail(id);
  await doctorModel.remove(id);
  res.status(204).end();
}

async function stats(req, res) {
  const id = parseId(req.params.id);
  await getOrFail(id);
  res.json(
    await doctorModel.getStats(id, { cap: MAX_APPOINTMENTS_PER_DAY, days: STATS_WINDOW_DAYS })
  );
}

module.exports = { list, get, create, update, remove, stats };
