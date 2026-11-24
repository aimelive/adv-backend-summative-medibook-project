const datePart = (dt) => String(dt).slice(0, 10);

function createSlotFreedHandler({ waitlist, bookAppointment, auditLog }) {
  return async function handleSlotFreed({ doctor_id: doctorId, appt_datetime: apptDatetime }) {
    const date = datePart(apptDatetime);

    // Loops only past patients who no longer exist; any other outcome returns.
    for (;;) {
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
        if (err.bookError === 'PATIENT_NOT_FOUND') {
          // A deleted patient can never be booked. Restoring them would block
          // everyone behind them, so drop them and offer the slot to the next patient.
          await waitlist.complete(doctorId, date, patientId);
          await auditLog('waitlist.dropped', {
            patient_id: patientId,
            doctor_id: doctorId,
            appt_datetime: apptDatetime,
            reason: err.message,
          });
          continue;
        }
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
  };
}

module.exports = { createSlotFreedHandler };
