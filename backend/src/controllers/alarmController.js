const Alarm = require('../models/Alarm');

/**
 * @desc    Create a new location alarm
 * @route   POST /api/alarms
 * @access  Private
 */
const createAlarm = async (req, res, next) => {
  try {
    const { name, destinationName, latitude, longitude, radius, notes } = req.body;

    const alarm = await Alarm.create({
      user: req.user._id,
      name: name.trim(),
      destinationName: destinationName.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius: Number(radius) || 1000,
      notes: notes ? notes.trim() : '',
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Alarm created successfully.',
      alarm,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all alarms for currently logged-in user
 * @route   GET /api/alarms
 * @access  Private
 */
const getAlarms = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };

    // Support optional filtering by status (active, paused, completed)
    if (req.query.status && ['active', 'paused', 'completed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const alarms = await Alarm.find(filter).sort({ createdAt: -1 });

    const stats = {
      total: await Alarm.countDocuments({ user: req.user._id }),
      active: await Alarm.countDocuments({ user: req.user._id, status: 'active' }),
      paused: await Alarm.countDocuments({ user: req.user._id, status: 'paused' }),
      completed: await Alarm.countDocuments({ user: req.user._id, status: 'completed' }),
    };

    res.status(200).json({
      success: true,
      count: alarms.length,
      stats,
      alarms,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single alarm by ID (only if owned by authenticated user)
 * @route   GET /api/alarms/:id
 * @access  Private
 */
const getAlarmById = async (req, res, next) => {
  try {
    const alarm = await Alarm.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found or you do not have permission to access it.',
      });
    }

    res.status(200).json({
      success: true,
      alarm,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an alarm
 * @route   PUT /api/alarms/:id
 * @access  Private
 */
const updateAlarm = async (req, res, next) => {
  try {
    const alarm = await Alarm.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found or you do not have permission to modify it.',
      });
    }

    const { name, destinationName, latitude, longitude, radius, notes, status } = req.body;

    if (name !== undefined) alarm.name = name.trim();
    if (destinationName !== undefined) alarm.destinationName = destinationName.trim();
    if (latitude !== undefined) alarm.latitude = Number(latitude);
    if (longitude !== undefined) alarm.longitude = Number(longitude);
    if (radius !== undefined) alarm.radius = Number(radius);
    if (notes !== undefined) alarm.notes = notes.trim();
    if (status !== undefined && ['active', 'paused', 'completed'].includes(status)) {
      alarm.status = status;
      if (status === 'completed' && !alarm.triggeredAt) {
        alarm.triggeredAt = new Date();
      } else if (status === 'active') {
        alarm.triggeredAt = null;
      }
    }

    const updatedAlarm = await alarm.save();

    res.status(200).json({
      success: true,
      message: 'Alarm updated successfully.',
      alarm: updatedAlarm,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an alarm
 * @route   DELETE /api/alarms/:id
 * @access  Private
 */
const deleteAlarm = async (req, res, next) => {
  try {
    const alarm = await Alarm.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found or you do not have permission to delete it.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Alarm deleted successfully.',
      alarmId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle or update alarm status (pause / resume / trigger)
 * @route   PATCH /api/alarms/:id/status
 * @access  Private
 */
const updateAlarmStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const alarm = await Alarm.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found or you do not have permission to update it.',
      });
    }

    alarm.status = status;

    if (status === 'completed') {
      alarm.triggeredAt = new Date();
    } else if (status === 'active') {
      alarm.triggeredAt = null; // Reset triggered timestamp if resumed
    }

    const updatedAlarm = await alarm.save();

    res.status(200).json({
      success: true,
      message: `Alarm status changed to ${status}.`,
      alarm: updatedAlarm,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAlarm,
  getAlarms,
  getAlarmById,
  updateAlarm,
  deleteAlarm,
  updateAlarmStatus,
};
