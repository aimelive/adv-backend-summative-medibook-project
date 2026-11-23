const { REFUND_TIERS } = require('../config/constants');

const MS_PER_HOUR = 60 * 60 * 1000;

// Policy: more than 48h -> 100%; 24h to 48h inclusive -> 50%; under 24h -> 0%.
function calculateRefund(amountPaid, apptDateTime, now = new Date()) {
  const hours = (new Date(apptDateTime).getTime() - new Date(now).getTime()) / MS_PER_HOUR;
  const [top, ...rest] = REFUND_TIERS;

  let percent = 0;
  if (hours > top.minHours) {
    percent = top.percent;
  } else {
    const tier = rest.find((t) => hours >= t.minHours);
    percent = tier ? tier.percent : 0;
  }

  return { percent, amount: Math.round(amountPaid * percent) / 100 };
}

module.exports = { calculateRefund };
