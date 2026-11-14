/**
 * Input validation middleware for GeoAlarm APIs.
 * Ensures consistent and clean validation errors before reaching controllers.
 */

const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Name is required and must be at least 2 characters long.',
    });
  }

  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'A valid email address is required.',
    });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password is required and must be at least 6 characters long.',
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Please provide your password.',
    });
  }

  next();
};

const validateAlarm = (req, res, next) => {
  const { name, destinationName, latitude, longitude, radius, status } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Alarm name is required.',
    });
  }

  if (!destinationName || typeof destinationName !== 'string' || destinationName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Destination name or address is required.',
    });
  }

  const lat = Number(latitude);
  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      message: 'Valid latitude is required (between -90 and 90).',
    });
  }

  const lon = Number(longitude);
  if (isNaN(lon) || lon < -180 || lon > 180) {
    return res.status(400).json({
      success: false,
      message: 'Valid longitude is required (between -180 and 180).',
    });
  }

  const rad = Number(radius);
  if (isNaN(rad) || rad < 50 || rad > 50000) {
    return res.status(400).json({
      success: false,
      message: 'Radius is required and must be between 50 and 50,000 meters.',
    });
  }

  if (status && !['active', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: active, paused, completed.',
    });
  }

  next();
};

const validateAlarmStatus = (req, res, next) => {
  const { status } = req.body;

  if (!status || !['active', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be active, paused, or completed.',
    });
  }

  next();
};

const validateAlarmUpdate = (req, res, next) => {
  const { name, destinationName, latitude, longitude, radius, status } = req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Alarm name cannot be empty.',
    });
  }

  if (destinationName !== undefined && (typeof destinationName !== 'string' || destinationName.trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Destination name or address cannot be empty.',
    });
  }

  if (latitude !== undefined) {
    const lat = Number(latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude is required (between -90 and 90).',
      });
    }
  }

  if (longitude !== undefined) {
    const lon = Number(longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid longitude is required (between -180 and 180).',
      });
    }
  }

  if (radius !== undefined) {
    const rad = Number(radius);
    if (isNaN(rad) || rad < 50 || rad > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Radius must be between 50 and 50,000 meters.',
      });
    }
  }

  if (status !== undefined && !['active', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: active, paused, completed.',
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateAlarm,
  validateAlarmUpdate,
  validateAlarmStatus,
};
