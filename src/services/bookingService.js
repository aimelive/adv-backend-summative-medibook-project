const appointmentModel = require('../models/appointmentModel');
const { HttpError } = require('../middleware/errorHandler');
const { validateSlot } = require('../utils/validateSlot');
const { auditLog } = require('../utils/auditLog');
const { enqueueConfirmation } = require('../queues');

const pad = (n) => String(n).padStart(2, '0');

// Local-time strings, consistent with validateSlot and the mysql2 pool's local timezone.
function toSqlParts(d) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { apptDate: date, apptDateTime: `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` };
}

const BOOK_ERRORS = {
  PATIENT_NOT_FOUND: [404, 'Patient not found'],
  DOCTOR_NOT_FOUND: [404, 'Doctor not found'],
  DAY_FULL: [409, 'Doctor is fully booked for that day'],
};

// The one place appointments get booked (used by the API and the worker).
// Throws HttpError on any failure; on success audits, enqueues the confirmation job, returns the appointment.
async function bookAppointment({ patientId, doctorId, apptDatetime }) {
  const slotError = validateSlot(apptDatetime);
  if (slotError) {
    // validateSlot returns 'Invalid date/time format' for unparseable input -> that is a 400.
    throw new HttpError(slotError === 'Invalid date/time format' ? 400 : 422, slotError);
  }

  const { apptDate, apptDateTime } = toSqlParts(new Date(apptDatetime));
  const waitlistOffer = {
    waitlist: {
      available: true,
      endpoint: 'POST /api/waitlist',
      body: { patient_id: patientId, doctor_id: doctorId, date: apptDate },
    },
  };

  let result;
  try {
    result = await appointmentModel.book({ patientId, doctorId, apptDate, apptDateTime });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That slot is already taken', waitlistOffer);
    throw err;
  }
  if (result.error) {
    const [status, message] = BOOK_ERRORS[result.error];
    throw new HttpError(status, message, status === 409 ? waitlistOffer : undefined);
  }
  const { appointment } = result;

  await auditLog('appointment.booked', {
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    amount_paid: appointment.amount_paid,
  });
  try {
    await enqueueConfirmation({
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appt_datetime: appointment.appt_datetime,
    });
  } catch (err) {
    console.error('Failed to enqueue confirmation job:', err.message);
  }
  return appointment;
}

module.exports = { bookAppointment };
