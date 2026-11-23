const { calculateRefund } = require('../src/utils/calculateRefund');

const now = new Date('2026-12-01T09:00:00');
const hoursAhead = (h) => new Date(now.getTime() + h * 3600 * 1000);

describe('calculateRefund', () => {
  test('more than 48h -> 100%', () => {
    expect(calculateRefund(100, hoursAhead(72), now)).toEqual({ percent: 100, amount: 100 });
  });
  test('exactly 48h -> 50% (100% needs more than 48h)', () => {
    expect(calculateRefund(100, hoursAhead(48), now)).toEqual({ percent: 50, amount: 50 });
  });
  test('between 24h and 48h -> 50%', () => {
    expect(calculateRefund(80, hoursAhead(36), now)).toEqual({ percent: 50, amount: 40 });
  });
  test('exactly 24h -> 50%', () => {
    expect(calculateRefund(100, hoursAhead(24), now)).toEqual({ percent: 50, amount: 50 });
  });
  test('under 24h -> 0%', () => {
    expect(calculateRefund(100, hoursAhead(23.99), now)).toEqual({ percent: 0, amount: 0 });
  });
  test('past appointment -> 0%', () => {
    expect(calculateRefund(100, hoursAhead(-5), now)).toEqual({ percent: 0, amount: 0 });
  });
});
