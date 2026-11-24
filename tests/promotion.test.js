const { createSlotFreedHandler } = require('../src/services/promotionService');

const JOB = { doctor_id: 1, appt_datetime: '2027-01-11 10:00:00' };
const DATE = '2027-01-11';

// In-memory stand-in for the Redis waitlist (waiting list + processing list).
function fakeWaitlist(initial) {
  const state = { waiting: [...initial], processing: [] };
  return {
    state,
    async takeNext() {
      if (state.waiting.length === 0) return null;
      const id = state.waiting.shift();
      state.processing.push(id);
      return id;
    },
    async complete(doctorId, date, patientId) {
      state.processing = state.processing.filter((id) => id !== patientId);
    },
    async restore(doctorId, date, patientId) {
      state.processing = state.processing.filter((id) => id !== patientId);
      state.waiting.unshift(patientId);
    },
  };
}

// Books every patient except the ones listed, which fail with the given error.
function fakeBooking(failures = {}) {
  let nextId = 100;
  return jest.fn(async ({ patientId }) => {
    if (failures[patientId]) throw failures[patientId];
    return { id: nextId++, patient_id: patientId };
  });
}

function patientNotFound() {
  const err = new Error('Patient not found');
  err.bookError = 'PATIENT_NOT_FOUND';
  return err;
}

function setup(initial, failures) {
  const waitlist = fakeWaitlist(initial);
  const bookAppointment = fakeBooking(failures);
  const auditLog = jest.fn(async () => {});
  const handle = createSlotFreedHandler({ waitlist, bookAppointment, auditLog });
  const events = () => auditLog.mock.calls.map(([event, data]) => [event, data.patient_id]);
  return { waitlist, bookAppointment, auditLog, handle, events };
}

describe('slot-freed promotion', () => {
  test('promotes the first waiting patient', async () => {
    const { waitlist, bookAppointment, handle, events } = setup([4, 2]);

    expect(await handle(JOB)).toEqual({ promoted: true, appointment_id: 100 });
    expect(bookAppointment).toHaveBeenCalledWith({
      patientId: 4,
      doctorId: 1,
      apptDatetime: JOB.appt_datetime,
    });
    expect(waitlist.state).toEqual({ waiting: [2], processing: [] });
    expect(events()).toEqual([['waitlist.promoted', 4]]);
  });

  test('empty waitlist: nothing is booked', async () => {
    const { bookAppointment, auditLog, handle } = setup([]);

    expect(await handle(JOB)).toEqual({ promoted: false });
    expect(bookAppointment).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('deleted patient is dropped and the next patient gets the slot', async () => {
    const { waitlist, handle, events } = setup([7, 1], { 7: patientNotFound() });

    expect(await handle(JOB)).toEqual({ promoted: true, appointment_id: 100 });
    // 7 is gone from both lists, not put back at the head.
    expect(waitlist.state).toEqual({ waiting: [], processing: [] });
    expect(events()).toEqual([
      ['waitlist.dropped', 7],
      ['waitlist.promoted', 1],
    ]);
  });

  test('several deleted patients in a row are all dropped', async () => {
    const { waitlist, bookAppointment, handle, events } = setup([5, 6, 1, 2], {
      5: patientNotFound(),
      6: patientNotFound(),
    });

    expect(await handle(JOB)).toEqual({ promoted: true, appointment_id: 100 });
    expect(bookAppointment).toHaveBeenCalledTimes(3);
    expect(waitlist.state).toEqual({ waiting: [2], processing: [] });
    expect(events()).toEqual([
      ['waitlist.dropped', 5],
      ['waitlist.dropped', 6],
      ['waitlist.promoted', 1],
    ]);
  });

  test('only a deleted patient waiting: dropped, nothing promoted', async () => {
    const { waitlist, handle, events } = setup([7], { 7: patientNotFound() });

    expect(await handle(JOB)).toEqual({ promoted: false });
    expect(waitlist.state).toEqual({ waiting: [], processing: [] });
    expect(events()).toEqual([['waitlist.dropped', 7]]);
  });

  test('temporary failure (slot retaken) puts the patient back at the head', async () => {
    const { waitlist, bookAppointment, handle, events } = setup([4, 2], {
      4: new Error('That slot is already taken'),
    });

    expect(await handle(JOB)).toEqual({ promoted: false, reason: 'That slot is already taken' });
    // 4 keeps their place and the patient behind them is not tried for this slot.
    expect(waitlist.state).toEqual({ waiting: [4, 2], processing: [] });
    expect(bookAppointment).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([['waitlist.promotion_failed', 4]]);
  });

  test('uses the date part of the freed slot for the waitlist key', async () => {
    const waitlist = fakeWaitlist([4]);
    const takeNext = jest.spyOn(waitlist, 'takeNext');
    const handle = createSlotFreedHandler({
      waitlist,
      bookAppointment: fakeBooking(),
      auditLog: async () => {},
    });

    await handle(JOB);
    expect(takeNext).toHaveBeenCalledWith(1, DATE);
  });
});
