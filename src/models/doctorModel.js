const pool = require('../config/db');

const COLUMNS = 'id, full_name, specialty, consultation_fee, room';

async function findAll() {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM doctors ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM doctors WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ full_name, specialty, consultation_fee, room }) {
  const [result] = await pool.query(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [full_name, specialty, consultation_fee, room]
  );
  return result.insertId;
}

async function update(id, { full_name, specialty, consultation_fee, room }) {
  const [result] = await pool.query(
    'UPDATE doctors SET full_name = ?, specialty = ?, consultation_fee = ?, room = ? WHERE id = ?',
    [full_name, specialty, consultation_fee, room, id]
  );
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM doctors WHERE id = ?', [id]);
  return result.affectedRows;
}

// Totals + 7-day series, all computed in SQL. Constants are bound as parameters.
async function getStats(id, { cap, days }) {
  const [[totals]] = await pool.query(
    `SELECT COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected,
            COALESCE(SUM(a.status = 'booked' AND a.appt_datetime > NOW()), 0) AS upcoming_booked
     FROM doctors d
     LEFT JOIN appointments a ON a.doctor_id = d.id
     WHERE d.id = ?`,
    [id]
  );
  const [series] = await pool.query(
    `WITH RECURSIVE day_list (day, n) AS (
       SELECT CURDATE(), 1
       UNION ALL
       SELECT day + INTERVAL 1 DAY, n + 1 FROM day_list WHERE n < ?
     )
     SELECT day_list.day AS date,
            COUNT(a.id) AS booked,
            ROUND(100 * SUM(COUNT(a.id)) OVER () / (? * COUNT(*) OVER ()), 2) AS utilization_percent
     FROM day_list
     LEFT JOIN appointments a
       ON a.doctor_id = ? AND a.status = 'booked' AND DATE(a.appt_datetime) = day_list.day
     GROUP BY day_list.day
     ORDER BY day_list.day`,
    [days, cap, id]
  );
  return {
    revenue_collected: totals.revenue_collected,
    upcoming_booked: Number(totals.upcoming_booked),
    utilization_percent: series[0].utilization_percent,
    next_days: series.map(({ date, booked }) => ({ date, booked })),
  };
}

module.exports = { findAll, findById, create, update, remove, getStats };
