/**
 * Free geocoding and reverse-geocoding service using OpenStreetMap Nominatim API.
 * Requires zero paid API keys.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export const geocodingService = {
  /**
   * Search for places/addresses by text query.
   * @param {string} query
   * @returns {Promise<Array<{ displayName: string, lat: number, lon: number, placeId: string }>>}
   */
  async searchPlaces(query) {
    if (!query || query.trim().length < 2) return [];

    try {
      const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&limit=6&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          // Nominatim usage policy recommends identifying the application
          'User-Agent': 'GeoAlarmApp/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((item) => ({
        placeId: item.place_id,
        displayName: item.display_name,
        name: item.name || item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
      }));
    } catch (error) {
      console.warn('Geocoding search failed, continuing gracefully:', error.message);
      return [];
    }
  },

  /**
   * Reverse geocode geographic coordinates to a human-readable address.
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lon) {
    try {
      const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GeoAlarmApp/1.0',
        },
      });

      if (!response.ok) {
        return `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
      }

      const data = await response.json();
      return data.display_name || `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    } catch (error) {
      console.warn('Reverse geocode failed, returning coordinates:', error.message);
      return `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    }
  },
};
