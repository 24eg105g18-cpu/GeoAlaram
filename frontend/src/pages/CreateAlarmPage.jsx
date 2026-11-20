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
import Footer from '../components/common/Footer';
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
    <div className="min-h-screen bg-[#0B1020] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#3B82F6] selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A364F]">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center text-xs font-semibold text-[#3B82F6] hover:text-[#8B5CF6] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Create Location Alarm
            </h1>
            <p className="text-sm text-[#94A3B8]">
              Drop a pin on your destination and choose how far in advance you want to be alerted.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={playAlarmTone}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#151C2E] border border-[#2A364F] text-[#F8FAFC] hover:bg-[#1E273E] hover:border-[#3B82F6]/50 transition-all shadow-sm"
              title="Test Web Audio Chime"
            >
              <Volume2 className="w-4 h-4 mr-1.5 text-[#3B82F6]" />
              <span>Test Alarm Tone</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-sm flex items-center space-x-2.5 shadow-sm animate-fadeIn">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{formSuccess}</span>
          </div>
        )}

        {formError && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-sm flex items-center space-x-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        {locationError && (
          <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2.5 shadow-sm">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{locationError}</span>
          </div>
        )}

        {/* 2-Column Responsive Form & Map Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Inputs (5 cols on large screens) */}
          <div className="lg:col-span-5 bg-[#151C2E] p-6 sm:p-7 rounded-3xl border border-[#2A364F] shadow-xl shadow-black/25 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Destination Search */}
              <div className="relative">
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                  1. Search Destination Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                    ) : (
                      <Search className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search train station, bus stop, landmark..."
                    className="block w-full pl-10 pr-3 py-2.5 text-sm bg-[#0B1020]/80 border border-[#2A364F] rounded-xl text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#8B5CF6]/25 transition-all"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1.5 w-full bg-[#1E273E] rounded-xl shadow-2xl border border-[#2A364F] max-h-60 overflow-y-auto divide-y divide-[#2A364F]/50">
                    {searchResults.map((item) => (
                      <button
                        key={item.placeId}
                        type="button"
                        onClick={() => handleSelectSearchResult(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#2A364F]/60 text-xs text-[#F8FAFC] flex items-start space-x-2.5 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                        <span className="truncate text-slate-200">{item.displayName}</span>
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
                  className="w-full flex items-center justify-center py-2.5 px-3 rounded-xl border border-[#2A364F] bg-[#1E273E]/70 hover:bg-[#1E273E] text-xs font-semibold text-[#F8FAFC] hover:border-[#3B82F6]/50 transition-all shadow-sm disabled:opacity-50"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#3B82F6]" />
                      <span>Reading GPS Coordinates...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 mr-2 text-[#3B82F6]" />
                      <span>Use My Current Location</span>
                    </>
                  )}
                </button>
              </div>

              {/* Destination Coordinates Summary Pill */}
              <div className="p-3.5 bg-[#0B1020]/70 rounded-xl border border-[#2A364F] text-xs space-y-1.5">
                <span className="text-[#94A3B8] font-semibold block uppercase text-[10px] tracking-wider">
                  Selected Coordinates
                </span>
                <div className="font-mono text-slate-300 text-[11px] flex justify-between">
                  <span>Lat: {latitude ? latitude.toFixed(5) : '—'}</span>
                  <span>Lon: {longitude ? longitude.toFixed(5) : '—'}</span>
                </div>
                <p className="text-[#94A3B8] text-[11px] truncate pt-0.5" title={destinationName}>
                  <strong className="text-slate-300 font-medium">Address:</strong>{' '}
                  {destinationName || 'Click anywhere on map to drop pin'}
                </p>
              </div>

              {/* Alarm Radius Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                  2. Choose Wake-Up Radius
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {radiusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRadius(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        radius === opt.value
                          ? 'border-[#3B82F6] bg-gradient-to-br from-[#3B82F6]/15 to-[#8B5CF6]/15 text-[#F8FAFC] ring-2 ring-[#3B82F6]/30 shadow-md shadow-blue-500/10'
                          : 'border-[#2A364F] bg-[#0B1020]/60 hover:bg-[#1E273E] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#F8FAFC]">{opt.label}</span>
                        {radius === opt.value && <Check className="w-4 h-4 text-[#3B82F6]" />}
                      </div>
                      <span className="text-[11px] text-[#94A3B8] block mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alarm Name Input */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
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
                    className="block w-full pl-10 pr-3 py-2.5 text-sm bg-[#0B1020]/80 border border-[#2A364F] rounded-xl text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#8B5CF6]/25 transition-all"
                  />
                </div>
              </div>

              {/* Optional Travel Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Travel Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Change to Blue Line, prepare luggage at platform..."
                  className="block w-full p-3 text-xs bg-[#0B1020]/80 border border-[#2A364F] rounded-xl text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#8B5CF6]/25 transition-all resize-none"
                ></textarea>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/25 hover:shadow-purple-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="lg:col-span-7 bg-[#151C2E] p-4 sm:p-5 rounded-3xl border border-[#2A364F] shadow-xl shadow-black/25 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-[#F8FAFC] flex items-center">
                <Compass className="w-4 h-4 mr-1.5 text-[#3B82F6]" />
                Interactive OpenStreetMap
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Click anywhere to set destination or drag the pin
              </span>
            </div>

            {/* Map Canvas */}
            <div className="w-full h-[540px] rounded-2xl overflow-hidden border border-[#2A364F]">
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

      <Footer />
    </div>
  );
};

export default CreateAlarmPage;
