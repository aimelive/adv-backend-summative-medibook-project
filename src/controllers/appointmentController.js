const appointmentModel = require('../models/appointmentModel');
const { HttpError } = require('../middleware/errorHandler');
const { parseId, requireBody, requireString } = require('../utils/validators');
const { bookAppointment } = require('../services/bookingService');
const { enqueueSlotFreed } = require('../queues');
const { auditLog } = require('../utils/auditLog');

const CANCEL_ERRORS = {
  NOT_FOUND: [404, 'Appointment not found'],
  ALREADY_CANCELLED: [409, 'Appointment is already cancelled'],
  PAST: [422, 'Cannot cancel an appointment in the past'],
};

function fail(table, code) {
  const [status, message] = table[code];
  throw new HttpError(status, message);
}

async function book(req, res) {
  const body = requireBody(req.body);
  const patientId = parseId(body.patient_id, 'patient_id');
  const doctorId = parseId(body.doctor_id, 'doctor_id');
  const apptDatetime = requireString(body, 'appt_datetime', 40);

  const appointment = await bookAppointment({ patientId, doctorId, apptDatetime });
  res.status(201).json(appointment);
}

async function cancel(req, res) {
  const id = parseId(req.params.id);
  const result = await appointmentModel.cancel(id);
  if (result.error) {
    fail(CANCEL_ERRORS, result.error);
  }
  const { appointment, refund } = result;

  try {
    await enqueueSlotFreed({ doctor_id: appointment.doctor_id, appt_datetime: appointment.appt_datetime });
  } catch (err) {
    console.error('Failed to enqueue slot-freed job:', err.message);
  }

  await auditLog('appointment.cancelled', {
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    refund_percent: refund.percent,
    refund_amount: refund.amount,
  });
  res.json({ ...appointment, refund_percent: refund.percent, refund_amount: refund.amount });
}

module.exports = { book, cancel };
