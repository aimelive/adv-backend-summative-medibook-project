const pool = require('../config/db');
const { MAX_APPOINTMENTS_PER_DAY } = require('../config/constants');
const { calculateRefund } = require('../utils/calculateRefund');

const COLUMNS =
  'id, patient_id, doctor_id, appt_datetime, status, amount_paid, refund_amount, booked_at, cancelled_at';

async function inTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// `apptDate` / `apptDateTime` are local 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' strings.
// Returns { appointment } or { error: 'PATIENT_NOT_FOUND' | 'DOCTOR_NOT_FOUND' | 'DAY_FULL' }.
// A taken slot surfaces as ER_DUP_ENTRY (unique key uq_doctor_slot), mapped to 409 centrally.
async function book({ patientId, doctorId, apptDate, apptDateTime }) {
  return inTransaction(async (conn) => {
    // Lock the doctor row: concurrent bookings for this doctor are serialized,
    // so the daily count below cannot be raced past the cap.
    const [doctors] = await conn.query(
      'SELECT id, consultation_fee FROM doctors WHERE id = ? FOR UPDATE',
      [doctorId]
    );
    if (!doctors[0]) return { error: 'DOCTOR_NOT_FOUND' };

    const [patients] = await conn.query('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (!patients[0]) return { error: 'PATIENT_NOT_FOUND' };

    const [[{ booked }]] = await conn.query(
      `SELECT COUNT(*) AS booked FROM appointments
       WHERE doctor_id = ? AND DATE(appt_datetime) = ? AND status = 'booked'`,
      [doctorId, apptDate]
    );
    if (booked >= MAX_APPOINTMENTS_PER_DAY) return { error: 'DAY_FULL' };

    const [result] = await conn.query(
      `INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid)
       VALUES (?, ?, ?, ?)`,
      [patientId, doctorId, apptDateTime, doctors[0].consultation_fee]
    );
    const [rows] = await conn.query(`SELECT ${COLUMNS} FROM appointments WHERE id = ?`, [
      result.insertId,
    ]);
    return { appointment: rows[0] };
  });
}

// Returns { appointment, refund } or { error: 'NOT_FOUND' | 'ALREADY_CANCELLED' | 'PAST' }.
async function cancel(id, now = new Date()) {
  return inTransaction(async (conn) => {
    const [found] = await conn.query(`SELECT ${COLUMNS} FROM appointments WHERE id = ? FOR UPDATE`, [
      id,
    ]);
    const appt = found[0];
    if (!appt) return { error: 'NOT_FOUND' };
    if (appt.status === 'cancelled') return { error: 'ALREADY_CANCELLED' };
    if (new Date(appt.appt_datetime) <= now) return { error: 'PAST' };

    const refund = calculateRefund(Number(appt.amount_paid), appt.appt_datetime, now);
    await conn.query(
      `UPDATE appointments
       SET status = 'cancelled', refund_amount = ?, cancelled_at = ?
       WHERE id = ?`,
      [refund.amount, now, id]
    );
    const [rows] = await conn.query(`SELECT ${COLUMNS} FROM appointments WHERE id = ?`, [id]);
    return { appointment: rows[0], refund };
  });
}

module.exports = { book, cancel };
