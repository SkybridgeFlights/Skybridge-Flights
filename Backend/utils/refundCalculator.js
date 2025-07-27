// utils/refundCalculator.js
const dayjs = require('dayjs');

function pickRule(rules, hoursBeforeDeparture, hoursSinceBooking) {
  // اختر أول rule تنطبق (يمكنك تحسين المنطق حسب حاجتك)
  return rules.find(r => {
    const withinMin = hoursBeforeDeparture >= (r.minHoursBeforeDeparture ?? 0);
    const withinMax = r.maxHoursBeforeDeparture == null
      ? true
      : hoursBeforeDeparture <= r.maxHoursBeforeDeparture;
    const withinSinceBooking = hoursSinceBooking >= (r.minHoursSinceBooking ?? 0);
    return withinMin && withinMax && withinSinceBooking;
  });
}

function computeRefund({ booking, policy, now = new Date() }) {
  const priceOutbound = booking.totalPrice || 0;
  const priceReturn   = booking.totalPriceReturn || 0;
  const totalPaid     = priceOutbound + priceReturn;

  // احسب الفرق الزمني
  const depDate = booking.flight?.date ? dayjs(booking.flight.date) : null;
  const hoursBeforeDeparture = depDate ? depDate.diff(now, 'hour', true) : 0;
  const hoursSinceBooking = dayjs(now).diff(dayjs(booking.createdAt), 'hour', true);

  const rule = pickRule(policy.rules, hoursBeforeDeparture, hoursSinceBooking);
  if (!rule) {
    return { percent: 0, fixedFee: 0, refundable: 0, totalPaid };
  }

  const percent = rule.percent;
  const fixedFee = rule.fixedFee || 0;

  const refundable = Math.max(0, (totalPaid * (percent / 100)) - fixedFee);

  return {
    totalPaid,
    percent,
    fixedFee,
    refundable,
    ruleUsed: rule
  };
}

module.exports = { computeRefund };