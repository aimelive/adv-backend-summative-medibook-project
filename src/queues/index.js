const { Queue } = require('bullmq');
const redis = require('../config/redis');

const QUEUE_NAME = 'medibook';
const queue = new Queue(QUEUE_NAME, { connection: redis });

const enqueueSlotFreed = (data) => queue.add('slot-freed', data);
const enqueueConfirmation = (data) => queue.add('confirmation', data);

module.exports = { QUEUE_NAME, queue, enqueueSlotFreed, enqueueConfirmation };
