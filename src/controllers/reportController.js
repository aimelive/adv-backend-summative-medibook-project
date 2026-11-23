const reportModel = require('../models/reportModel');
const { MAX_APPOINTMENTS_PER_DAY, BUSY_THRESHOLD } = require('../config/constants');

async function doctors(req, res) {
  res.json(await reportModel.doctorsReport());
}

async function busyDays(req, res) {
  res.json(
    await reportModel.busyDays({ cap: MAX_APPOINTMENTS_PER_DAY, threshold: BUSY_THRESHOLD })
  );
}

module.exports = { doctors, busyDays };
