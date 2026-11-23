const express = require('express');
const controller = require('../controllers/appointmentController');

const router = express.Router();

router.post('/', controller.book);
router.patch('/:id/cancel', controller.cancel);

module.exports = router;
