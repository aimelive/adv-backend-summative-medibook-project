const pool = require('../config/db');

const COLUMNS = 'id, full_name, email, phone, created_at';

async function findAll() {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM patients ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM patients WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ full_name, email, phone }) {
  const [result] = await pool.query(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [full_name, email, phone]
  );
  return result.insertId;
}

async function update(id, { full_name, email, phone }) {
  const [result] = await pool.query(
    'UPDATE patients SET full_name = ?, email = ?, phone = ? WHERE id = ?',
    [full_name, email, phone, id]
  );
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM patients WHERE id = ?', [id]);
  return result.affectedRows;
}

module.exports = { findAll, findById, create, update, remove };
