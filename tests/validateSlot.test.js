const { validateSlot } = require('../src/utils/validateSlot');

const now = new Date('2026-12-01T08:00:00');

describe('validateSlot', () => {
  test('09:00 is valid', () => {
    expect(validateSlot('2026-12-02T09:00:00', now)).toBeNull();
  });
  test('16:30 (last slot) is valid', () => {
    expect(validateSlot('2026-12-02T16:30:00', now)).toBeNull();
  });
  test('17:00 is rejected (outside hours)', () => {
    expect(validateSlot('2026-12-02T17:00:00', now)).toMatch(/between/);
  });
  test('09:15 is rejected (not on boundary)', () => {
    expect(validateSlot('2026-12-02T09:15:00', now)).toMatch(/boundary/);
  });
  test('08:30 is rejected (before opening)', () => {
    expect(validateSlot('2026-12-02T08:30:00', now)).toMatch(/between/);
  });
  test('malformed string is rejected', () => {
    expect(validateSlot('not-a-date', now)).toMatch(/Invalid/);
  });
  test('past date is rejected', () => {
    expect(validateSlot('2026-11-30T10:00:00', now)).toMatch(/future/);
  });
});
