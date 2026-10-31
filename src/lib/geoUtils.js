/**
 * Geographic calculation and reverse geocoding utilities.
 * Uses Nominatim with in-memory caching and strict 1 req/sec rate limiting.
 */
import { ZONES } from '../config';

// In-memory cache for reverse geocoding: "lat,lng" => address string
const geocodeCache = new Map();

// Throttle queue for Nominatim (strict max 1 request per 1.1 second)
let lastRequestTime = 0;
const NOMINATIM_INTERVAL_MS = 1100;

/**
 * Calculates Haversine distance in meters between two [lat, lng] coordinates.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Formats distance in meters into human-readable string (e.g. "45 m", "1.2 km").
 * 
 * @param {number} meters 
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Reverse-geocodes coordinates into a readable address using OpenStreetMap Nominatim.
 * Throttled to max 1 req/sec and cached by rounded coordinates.
 * 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<string>} Human readable address
 */
export async function reverseGeocode(lat, lng) {
  // Round to 4 decimal places (~11 meters) for cache key
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Rate limit delay
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < NOMINATIM_INTERVAL_MS) {
    await new Promise((res) => setTimeout(res, NOMINATIM_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CivicEye-CivicReporter/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim error: ${res.status}`);
    }

    const data = await res.json();
    const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache.set(cacheKey, address);
    return address;
  } catch (err) {
    console.warn('Reverse geocoding failed, using coordinates fallback:', err.message);
    const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Assigns a zone based on coordinates (deterministic partition for hackathon demos).
 * 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {string} One of ZONES ('zone_1', 'zone_2', 'zone_3')
 */
export function getZoneForLocation(lat, lng) {
  // Simple spatial quadrant or modulo hash for demo partitioning
  const hash = Math.abs(Math.floor((lat + lng) * 100)) % ZONES.length;
  return ZONES[hash] || 'zone_1';
}
