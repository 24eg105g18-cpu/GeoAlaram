/**
 * Calculate the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters (6,371,000 m)
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance rounded to nearest meter
};

/**
 * Check if current location is within target radius of destination.
 *
 * @param {number} currentLat
 * @param {number} currentLon
 * @param {number} targetLat
 * @param {number} targetLon
 * @param {number} radiusInMeters
 * @returns {{ isWithinRadius: boolean, distanceInMeters: number }}
 */
const isInsideRadius = (currentLat, currentLon, targetLat, targetLon, radiusInMeters) => {
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  return {
    isWithinRadius: distance <= radiusInMeters,
    distanceInMeters: distance,
  };
};

module.exports = { calculateDistance, isInsideRadius };
