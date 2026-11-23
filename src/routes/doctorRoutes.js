const express = require('express');
const controller = require('../controllers/doctorController');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);
router.get('/:id/stats', controller.stats);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
