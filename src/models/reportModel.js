const pool = require('../config/db');

async function doctorsReport() {
  const [rows] = await pool.query(
    `SELECT d.id, d.full_name, d.specialty,
            COUNT(a.id) AS total_appointments,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected
     FROM doctors d
     LEFT JOIN appointments a ON a.doctor_id = d.id
     GROUP BY d.id, d.full_name, d.specialty
     ORDER BY d.id`
  );
  return rows;
}

// Days where booked count > cap * threshold (both bound as parameters).
async function busyDays({ cap, threshold }) {
  const [rows] = await pool.query(
    `SELECT d.id AS doctor_id, d.full_name, DATE(a.appt_datetime) AS date, COUNT(*) AS booked
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.status = 'booked'
     GROUP BY d.id, d.full_name, DATE(a.appt_datetime)
     HAVING COUNT(*) > ? * ?
     ORDER BY date, d.id`,
    [cap, threshold]
  );
  return rows;
}

module.exports = { doctorsReport, busyDays };
