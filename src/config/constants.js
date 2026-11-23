module.exports = {
  MAX_APPOINTMENTS_PER_DAY: 12,
  SLOT_MINUTES: 30,
  WORKING_HOURS: { start: '09:00', end: '17:00' },
  REFUND_TIERS: [
    { minHours: 48, percent: 100 },
    { minHours: 24, percent: 50 },
    { minHours: 0, percent: 0 },
  ],
  BUSY_THRESHOLD: 0.8,
  STATS_WINDOW_DAYS: 7,
};
