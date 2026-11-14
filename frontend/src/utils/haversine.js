/**
 * Haversine formula utility for calculating great-circle distance
 * between two GPS coordinates on Earth in meters.
 */

const EARTH_RADIUS_METERS = 6371e3; // 6,371,000 meters

/**
 * Convert degrees to radians.
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Calculate distance in meters between two coordinates.
 * Safely handles string or numeric inputs and validates finiteness.
 *
 * @param {number|string} lat1
 * @param {number|string} lon1
 * @param {number|string} lat2
 * @param {number|string} lon2
 * @returns {number} Distance in meters (rounded to nearest meter) or Infinity if invalid
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2)
  ) {
    console.warn('[Haversine] Invalid non-finite coordinates provided:', { lat1, lon1, lat2, lon2 });
    return Infinity;
  }

  // Range validation
  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90 ||
      nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) {
    console.warn('[Haversine] Coordinates out of geographical range [-90..90, -180..180]:', { nLat1, nLon1, nLat2, nLon2 });
    return Infinity;
  }

  const φ1 = toRadians(nLat1);
  const φ2 = toRadians(nLat2);
  const Δφ = toRadians(nLat2 - nLat1);
  const Δλ = toRadians(nLon2 - nLon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
};

/**
 * Format meters into a clean human-readable string (e.g. 350m or 2.4 km).
 * @param {number} meters
 * @returns {string}
 */
export const formatDistance = (meters) => {
  if (meters === null || meters === undefined || !Number.isFinite(Number(meters))) return '—';
  const num = Number(meters);
  if (num < 1000) {
    return `${Math.round(num)} m`;
  }
  return `${(num / 1000).toFixed(1)} km`;
};

/**
 * Check if a location is within target radius.
 * @param {number} currentLat
 * @param {number} currentLon
 * @param {number} targetLat
 * @param {number} targetLon
 * @param {number} radiusInMeters
 * @returns {{ isInside: boolean, distance: number }}
 */
export const checkProximity = (currentLat, currentLon, targetLat, targetLon, radiusInMeters) => {
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  return {
    isInside: Number.isFinite(distance) && distance <= Number(radiusInMeters),
    distance,
  };
};
