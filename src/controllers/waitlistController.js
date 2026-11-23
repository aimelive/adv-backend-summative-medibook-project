const patientModel = require('../models/patientModel');
const doctorModel = require('../models/doctorModel');
const waitlist = require('../services/waitlistService');
const { HttpError } = require('../middleware/errorHandler');
const { parseId, requireBody, requireString } = require('../utils/validators');

async function join(req, res) {
  const body = requireBody(req.body);
  const patientId = parseId(body.patient_id, 'patient_id');
  const doctorId = parseId(body.doctor_id, 'doctor_id');
  const date = requireString(body, 'date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, 'date must be a valid YYYY-MM-DD date');
  }
  if (!(await patientModel.findById(patientId))) throw new HttpError(404, 'Patient not found');
  if (!(await doctorModel.findById(doctorId))) throw new HttpError(404, 'Doctor not found');

  const { added, position } = await waitlist.add(doctorId, date, patientId);
  if (!added) throw new HttpError(409, 'Patient is already on this waitlist', { position });
  res.status(201).json({ patient_id: patientId, doctor_id: doctorId, date, position });
}

module.exports = { join };
