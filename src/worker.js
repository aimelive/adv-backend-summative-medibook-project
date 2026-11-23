require('dotenv').config();
const { Worker } = require('bullmq');
const redis = require('./config/redis');
const pool = require('./config/db');
const { QUEUE_NAME, queue } = require('./queues');
const waitlist = require('./services/waitlistService');
const { bookAppointment } = require('./services/bookingService');
const patientModel = require('./models/patientModel');
const { auditLog } = require('./utils/auditLog');

// Local 'YYYY-MM-DD' from an appt_datetime string ('YYYY-MM-DD HH:MM:SS').
const datePart = (dt) => String(dt).slice(0, 10);

async function handleSlotFreed({ doctor_id: doctorId, appt_datetime: apptDatetime }) {
  const date = datePart(apptDatetime);
  const patientId = await waitlist.takeNext(doctorId, date);
  if (patientId === null) return { promoted: false };

  try {
    const appointment = await bookAppointment({ patientId, doctorId, apptDatetime });
    await waitlist.complete(doctorId, date, patientId);
    await auditLog('waitlist.promoted', {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointment.id,
    });
    return { promoted: true, appointment_id: appointment.id };
  } catch (err) {
    await waitlist.restore(doctorId, date, patientId);
    await auditLog('waitlist.promotion_failed', {
      patient_id: patientId,
      doctor_id: doctorId,
      appt_datetime: apptDatetime,
      reason: err.message,
    });
    return { promoted: false, reason: err.message };
  }
}

async function handleConfirmation(data) {
  const patient = await patientModel.findById(data.patient_id);
  const to = patient ? `${patient.email} / ${patient.phone}` : `patient #${data.patient_id}`;
  await auditLog('notification.confirmation_sent', {
    appointment_id: data.appointment_id,
    patient_id: data.patient_id,
    message: `To ${to}: your appointment with doctor #${data.doctor_id} on ${data.appt_datetime} is confirmed.`,
  });
}

async function main() {
  const recovered = await waitlist.recoverProcessing();
  console.log(`Recovered ${recovered} leftover waitlist ${recovered === 1 ? 'entry' : 'entries'}`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'slot-freed') return handleSlotFreed(job.data);
      if (job.name === 'confirmation') return handleConfirmation(job.data);
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection: redis }
  );
  worker.on('failed', (job, err) => console.error(`Job ${job && job.name} failed:`, err.message));
  console.log('Worker started');

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await redis.quit();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
