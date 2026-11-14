const { calculateDistance, isInsideRadius } = require('../utils/haversine');

/**
 * Service to handle location business logic, geofence checks, and proximity evaluations.
 */
class LocationService {
  /**
   * Evaluate if a user's current GPS coordinate triggers any of their active alarms.
   *
   * @param {{ latitude: number, longitude: number }} currentLocation
   * @param {Array<Object>} alarms
   * @returns {Array<Object>} List of alarms with proximity calculations and trigger flag
   */
  evaluateAlarms(currentLocation, alarms) {
    if (!currentLocation || typeof currentLocation.latitude !== 'number' || typeof currentLocation.longitude !== 'number') {
      throw new Error('Valid current coordinates (latitude, longitude) are required.');
    }

    return alarms.map((alarm) => {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        alarm.latitude,
        alarm.longitude
      );

      const isInside = distance <= alarm.radius;

      return {
        alarmId: alarm._id,
        name: alarm.name,
        destinationName: alarm.destinationName,
        radius: alarm.radius,
        status: alarm.status,
        currentDistance: distance,
        isTriggered: isInside && alarm.status === 'active',
        remainingMeters: Math.max(0, distance - alarm.radius),
      };
    });
  }
}

module.exports = new LocationService();
