const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for an alarm'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide an alarm name'],
      trim: true,
      maxlength: [100, 'Alarm name cannot exceed 100 characters'],
    },
    destinationName: {
      type: String,
      required: [true, 'Please provide a destination name or address'],
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Destination latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    longitude: {
      type: Number,
      required: [true, 'Destination longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    radius: {
      type: Number,
      required: [true, 'Alert radius in meters is required'],
      min: [50, 'Radius must be at least 50 meters'],
      max: [50000, 'Radius cannot exceed 50,000 meters (50km)'],
      default: 1000, // Default 1km (1000 meters)
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'paused', 'completed'],
        message: 'Status must be active, paused, or completed',
      },
      default: 'active',
    },
    triggeredAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Alarm', alarmSchema);
