/**
 * LocationPickerMap — mini Leaflet map with GPS detection and manual pin-drop.
 * Uses CircleMarker to avoid Vite icon bundling breakages.
 */
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../config';
import { reverseGeocode } from '../lib/geoUtils';

/**
 * Handles map click events to reposition the pin.
 */
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Recenter map view when center prop changes.
 */
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function LocationPickerMap({
  location,
  onLocationChange,
  className = 'h-64',
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const currentLat = location?.lat || DEFAULT_CENTER[0];
  const currentLng = location?.lng || DEFAULT_CENTER[1];

  const handleCoordinateChange = async (lat, lng) => {
    setAddressLoading(true);
    setGeoError('');
    try {
      const address = await reverseGeocode(lat, lng);
      onLocationChange({
        lat,
        lng,
        address,
      });
    } catch {
      onLocationChange({
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
    } finally {
      setAddressLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleCoordinateChange(latitude, longitude);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setGeoError('Could not retrieve GPS location. Click anywhere on the map to drop a pin.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Location <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
        >
          {gpsLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Locating...
            </>
          ) : (
            <>
              <span>🎯</span> Use My Current Location
            </>
          )}
        </button>
      </div>

      {geoError && (
        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">{geoError}</p>
      )}

      {/* Map container with explicit height */}
      <div className={`relative rounded-xl overflow-hidden border border-gray-300 shadow-sm ${className}`}>
        <MapContainer
          center={[currentLat, currentLng]}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleCoordinateChange} />
          <RecenterMap center={[currentLat, currentLng]} />

          {/* Issue marker circle */}
          <CircleMarker
            center={[currentLat, currentLng]}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#dc2626',
              fillOpacity: 0.9,
              weight: 3,
            }}
          />
        </MapContainer>

        <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[11px] text-gray-600 shadow-sm border border-gray-200">
          Click map to adjust pin
        </div>
      </div>

      {/* Address display / manual edit */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1">
        <div className="flex items-center justify-between text-gray-500">
          <span className="font-medium">Detected Address:</span>
          {addressLoading && <span className="text-blue-600 font-medium">Resolving address...</span>}
        </div>
        <p className="text-gray-800 font-medium break-words">
          {location?.address || 'No location selected yet. Click map or use current location.'}
        </p>
        <p className="text-[11px] text-gray-400 font-mono">
          Coords: {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
        </p>
      </div>
    </div>
  );
}
