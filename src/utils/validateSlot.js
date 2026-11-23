const { SLOT_MINUTES, WORKING_HOURS } = require('../config/constants');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Returns an error message, or null if the slot is valid.
function validateSlot(dateTime, now = new Date()) {
  const date = new Date(dateTime);
  if (dateTime === null || dateTime === undefined || Number.isNaN(date.getTime())) {
    return 'Invalid date/time format';
  }
  if (date.getTime() <= new Date(now).getTime()) {
    return 'Appointment must be in the future';
  }

  const minutes = date.getHours() * 60 + date.getMinutes();
  const first = toMinutes(WORKING_HOURS.start);
  const lastStart = toMinutes(WORKING_HOURS.end) - SLOT_MINUTES;
  if (minutes < first || minutes > lastStart) {
    return `Appointment must start between ${WORKING_HOURS.start} and ${String(Math.floor(lastStart / 60)).padStart(2, '0')}:${String(lastStart % 60).padStart(2, '0')}`;
  }
  if (minutes % SLOT_MINUTES !== 0 || date.getSeconds() !== 0) {
    return `Appointment must start on a :00 or :30 boundary`;
  }
  return null;
}

module.exports = { validateSlot };
