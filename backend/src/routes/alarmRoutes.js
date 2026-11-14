const express = require('express');
const router = express.Router();
const {
  createAlarm,
  getAlarms,
  getAlarmById,
  updateAlarm,
  deleteAlarm,
  updateAlarmStatus,
} = require('../controllers/alarmController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateAlarm,
  validateAlarmUpdate,
  validateAlarmStatus,
} = require('../middleware/validationMiddleware');

// All alarm endpoints require valid JWT authentication
router.use(protect);

router.route('/')
  .post(validateAlarm, createAlarm)
  .get(getAlarms);

router.route('/:id')
  .get(getAlarmById)
  .put(validateAlarmUpdate, updateAlarm)
  .delete(deleteAlarm);

router.patch('/:id/status', validateAlarmStatus, updateAlarmStatus);

module.exports = router;
