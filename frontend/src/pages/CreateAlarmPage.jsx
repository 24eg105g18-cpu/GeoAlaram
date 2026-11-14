import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  Navigation,
  Bell,
  Volume2,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Info,
  Compass,
} from 'lucide-react';
import Navbar from '../components/common/Navbar';
import LocationPickerMap from '../components/map/LocationPickerMap';
import { alarmService } from '../services/alarmService';
import { geocodingService } from '../services/geocodingService';
import { playAlarmTone } from '../utils/sound';

export const CreateAlarmPage = () => {
  const navigate = useNavigate();

  // Form State
  const [alarmName, setAlarmName] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [latitude, setLatitude] = useState(12.9716); // Default: Bengaluru
  const [longitude, setLongitude] = useState(77.5946);
  const [radius, setRadius] = useState(1000); // Default 1km
  const [notes, setNotes] = useState('');

  // Geolocation & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const searchDebounceRef = useRef(null);

  // Quick radius presets
  const radiusOptions = [
    { value: 500, label: '500m', desc: 'Walking & Bus' },
    { value: 1000, label: '1 km', desc: 'City Commute' },
    { value: 2000, label: '2 km', desc: 'Subway & Train' },
    { value: 5000, label: '5 km', desc: 'Express Route' },
  ];

  // Request browser location on mount to show user's current position if allowed
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          setUserLocation({ lat, lng });
        },
        (err) => {
          console.log('Location not granted initially (optional):', err.message);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Handle Search Input with Debounce
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await geocodingService.searchPlaces(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 450);
  };

  // Select a place from autocomplete search dropdown
  const handleSelectSearchResult = (place) => {
    setLatitude(place.lat);
    setLongitude(place.lon);
    setDestinationName(place.displayName);
    if (!alarmName) {
      setAlarmName(place.name || place.displayName.split(',')[0]);
    }
    setSearchResults([]);
    setSearchQuery(place.name || place.displayName.split(',')[0]);
  };

  // Handle user clicking directly on the map
  const handleMapClick = async (lat, lng) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationError('');

    // Reverse geocode to get a human-readable address
    const address = await geocodingService.reverseGeocode(lat, lng);
    setDestinationName(address);
    if (!alarmName) {
      const shortName = address.split(',')[0];
      setAlarmName(shortName ? `Alarm for ${shortName}` : 'My Destination');
    }
    setSearchQuery(address.split(',')[0]);
  };

  // "Use My Current Location" button handler
  const handleGetCurrentLocation = () => {
    setLocationError('');
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your current browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setLatitude(lat);
        setLongitude(lng);

        const address = await geocodingService.reverseGeocode(lat, lng);
        setDestinationName(address);
        if (!alarmName) {
          setAlarmName('Current Location Stop');
        }
        setSearchQuery(address.split(',')[0]);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError('Location permission denied. Please click on the map to pick your destination.');
        } else if (err.code === 2) {
          setLocationError('GPS position unavailable. Please search for an address or click the map.');
        } else {
          setLocationError('Location request timed out. Please try again or select on the map.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!alarmName.trim()) {
      setFormError('Please enter an alarm name.');
      return;
    }

    if (!destinationName.trim()) {
      setFormError('Please select or search for a destination address.');
      return;
    }

    if (latitude === null || longitude === null) {
      setFormError('Please select a destination point on the map.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await alarmService.createAlarm({
        name: alarmName.trim(),
        destinationName: destinationName.trim(),
        latitude,
        longitude,
        radius,
        notes: notes.trim(),
      });

      if (res.success) {
        setFormSuccess('Alarm created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    } catch (err) {
      setFormError(
        err.response?.data?.message || 'Failed to create alarm. Please check your inputs.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
              <Link to="/dashboard" className="inline-flex items-center hover:underline">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              Create Location Alarm
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Drop a pin on your destination and choose how far in advance you want to be alerted.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={playAlarmTone}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
              title="Test Web Audio Chime"
            >
              <Volume2 className="w-4 h-4 mr-1.5 text-brand-600" />
              <span>Test Alarm Tone</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2">
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{formSuccess}</span>
          </div>
        )}

        {formError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        {locationError && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{locationError}</span>
          </div>
        )}

        {/* 2-Column Responsive Form & Map Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Inputs (5 cols on large screens) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Destination Search */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Search Destination Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search train station, bus stop, landmark..."
                    className="block w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((item) => (
                      <button
                        key={item.placeId}
                        type="button"
                        onClick={() => handleSelectSearchResult(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-brand-50 text-xs text-slate-700 flex items-start space-x-2 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                        <span className="truncate">{item.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Use Current Location Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="w-full flex items-center justify-center py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-brand-600" />
                      <span>Reading GPS Coordinates...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 mr-2 text-brand-600" />
                      <span>Use My Current Location</span>
                    </>
                  )}
                </button>
              </div>

              {/* Destination Coordinates Summary Pill */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">
                  Selected Coordinates
                </span>
                <div className="font-mono text-slate-800 text-[11px] flex justify-between">
                  <span>Lat: {latitude ? latitude.toFixed(5) : '—'}</span>
                  <span>Lon: {longitude ? longitude.toFixed(5) : '—'}</span>
                </div>
                <p className="text-slate-600 text-[11px] truncate pt-0.5" title={destinationName}>
                  <strong>Address:</strong> {destinationName || 'Click anywhere on map to drop pin'}
                </p>
              </div>

              {/* Alarm Radius Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  2. Choose Wake-Up Radius
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {radiusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRadius(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        radius === opt.value
                          ? 'border-brand-600 bg-brand-50/80 text-brand-900 ring-2 ring-brand-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{opt.label}</span>
                        {radius === opt.value && <Check className="w-4 h-4 text-brand-600" />}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alarm Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Alarm Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={alarmName}
                    onChange={(e) => setAlarmName(e.target.value)}
                    placeholder="e.g. Central Metro Station Exit"
                    className="block w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Optional Travel Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Travel Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Change to Blue Line, prepare luggage at platform..."
                  className="block w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                ></textarea>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-60 transition-all duration-150"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Saving Alarm...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>Save Location Alarm</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Interactive Leaflet Map (7 cols on large screens) */}
          <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span className="font-semibold text-slate-800 flex items-center">
                <Compass className="w-4 h-4 mr-1.5 text-brand-600" />
                Interactive OpenStreetMap
              </span>
              <span className="text-[11px] text-slate-500">
                Click anywhere to set destination or drag the pin
              </span>
            </div>

            {/* Map Canvas */}
            <div className="w-full h-[540px]">
              <LocationPickerMap
                destinationLat={latitude}
                destinationLng={longitude}
                radius={radius}
                userLat={userLocation?.lat}
                userLng={userLocation?.lng}
                onLocationSelect={handleMapClick}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateAlarmPage;
