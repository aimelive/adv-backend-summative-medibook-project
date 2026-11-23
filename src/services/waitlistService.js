const redis = require('../config/redis');

const waitlistKey = (doctorId, date) => `waitlist:${doctorId}:${date}`;
const processingKey = (doctorId, date) => `waitlist:processing:${doctorId}:${date}`;

// Returns { added: true, position } or { added: false, position } when already waiting.
async function add(doctorId, date, patientId) {
  const key = waitlistKey(doctorId, date);
  const id = String(patientId);
  const [queued, processing] = await Promise.all([
    redis.lpos(key, id),
    redis.lpos(processingKey(doctorId, date), id),
  ]);
  if (queued !== null || processing !== null) {
    return { added: false, position: queued === null ? 0 : queued + 1 };
  }
  const length = await redis.rpush(key, id);
  return { added: true, position: length };
}

// Atomically moves the first waiting patient into the processing list.
async function takeNext(doctorId, date) {
  const id = await redis.lmove(waitlistKey(doctorId, date), processingKey(doctorId, date), 'LEFT', 'RIGHT');
  return id === null ? null : Number(id);
}

async function complete(doctorId, date, patientId) {
  await redis.lrem(processingKey(doctorId, date), 1, String(patientId));
}

// Puts a patient back at the head of the waitlist.
async function restore(doctorId, date, patientId) {
  await redis
    .multi()
    .lrem(processingKey(doctorId, date), 1, String(patientId))
    .lpush(waitlistKey(doctorId, date), String(patientId))
    .exec();
}

// Startup recovery: anything still in a processing list belongs back on its waitlist.
async function recoverProcessing() {
  let recovered = 0;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'waitlist:processing:*', 'COUNT', 100);
    cursor = next;
    for (const key of keys) {
      const target = key.replace('waitlist:processing:', 'waitlist:');
      while ((await redis.lmove(key, target, 'RIGHT', 'LEFT')) !== null) recovered += 1;
    }
  } while (cursor !== '0');
  return recovered;
}

module.exports = { add, takeNext, complete, restore, recoverProcessing };
