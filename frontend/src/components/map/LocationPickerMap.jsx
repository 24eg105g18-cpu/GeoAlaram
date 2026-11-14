import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

// Create high-resolution custom SVG marker icons (bypasses missing PNG asset issues in bundlers)
const destinationIcon = L.divIcon({
  className: 'custom-destination-marker',
  html: `
    <div style="
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <svg width="36" height="42" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <path d="M12 0C5.372 0 0 5.372 0 12C0 19.5 10.5 27.2 11.4 27.8C11.6 27.9 11.8 28 12 28C12.2 28 12.4 27.9 12.6 27.8C13.5 27.2 24 19.5 24 12C24 5.372 18.628 0 12 0Z" fill="#2563eb"/>
        <circle cx="12" cy="11" r="5" fill="white"/>
        <circle cx="12" cy="11" r="2.5" fill="#1e3a8a"/>
      </svg>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #10b981;
      border: 3px solid white;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.35);
      transform: translate(-50%, -50%);
    "></div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

// Component to handle user clicking anywhere on the map
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to smoothly pan the map view when coordinates change
function RecenterView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || map.getZoom(), {
        duration: 1.2,
      });
    }
  }, [center[0], center[1], zoom, map]);
  return null;
}

export const LocationPickerMap = ({
  destinationLat,
  destinationLng,
  radius = 1000,
  userLat,
  userLng,
  onLocationSelect,
  zoom = 13,
}) => {
  const defaultCenter = useMemo(() => {
    if (destinationLat && destinationLng) {
      return [destinationLat, destinationLng];
    }
    if (userLat && userLng) {
      return [userLat, userLng];
    }
    return [12.9716, 77.5946]; // Default fallback: Bengaluru
  }, [destinationLat, destinationLng, userLat, userLng]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Map Click Listener */}
        <MapClickHandler onMapClick={onLocationSelect} />

        {/* Smooth auto-recenter when coordinates update */}
        <RecenterView
          center={[destinationLat || defaultCenter[0], destinationLng || defaultCenter[1]]}
          zoom={zoom}
        />

        {/* User Current Location Marker */}
        {userLat && userLng && (
          <Marker position={[userLat, userLng]} icon={userLocationIcon} />
        )}

        {/* Selected Destination Marker */}
        {destinationLat && destinationLng && (
          <>
            <Marker
              position={[destinationLat, destinationLng]}
              icon={destinationIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onLocationSelect(position.lat, position.lng);
                },
              }}
            />

            {/* Live Radius Circle */}
            <Circle
              center={[destinationLat, destinationLng]}
              radius={radius}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '4, 6',
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Floating Map Legend Pill */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] text-slate-700 space-y-1">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
          <span className="font-medium">Destination Pin (Click / Drag to set)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full border border-brand-500 bg-brand-200"></span>
          <span>Alert Radius ({radius >= 1000 ? `${radius / 1000} km` : `${radius}m`})</span>
        </div>
        {userLat && (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Your Current Location</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationPickerMap;
