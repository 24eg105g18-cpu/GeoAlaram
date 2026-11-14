import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Bell,
  Compass,
  Navigation,
  Shield,
  Volume2,
  CheckCircle,
  ArrowRight,
  Radio,
  Clock,
  Smartphone,
} from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-white via-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline and CTAs */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping"></span>
                <span>Location-Based Alarm Technology</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-950 tracking-tight leading-[1.15]">
                Never Miss Your <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">
                  Destination Again.
                </span>
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Traditional alarms wake you at a fixed time—even if your bus is delayed or traffic slows down. 
                <strong> GeoAlarm</strong> wakes you when you physically arrive within your selected destination radius.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/register'}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-600/30 hover:shadow-brand-600/40 transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>

                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-200"
                >
                  <span>See How It Works</span>
                </a>
              </div>

              <div className="flex items-center justify-center lg:justify-start space-x-6 pt-4 text-xs font-medium text-slate-500">
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5" /> No Credit Card Required
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5" /> 100% Free Open Maps
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5" /> Audio & Web Alerts
                </span>
              </div>
            </div>

            {/* Right Column: Visual Simulated App Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md bg-white rounded-3xl p-6 shadow-2xl shadow-slate-300 border border-slate-200/80">
                {/* Header card pill */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Live Foreground Tracking
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                    GPS Active
                  </span>
                </div>

                {/* Simulated Geofence destination */}
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 text-white shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-brand-300 font-semibold uppercase tracking-wider">Target Destination</p>
                      <h3 className="text-lg font-bold mt-0.5">Central Railway Station</h3>
                      <p className="text-xs text-slate-300 mt-1 flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-rose-400" /> Platform 1 & North Exit
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white backdrop-blur">
                      <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                    </div>
                  </div>

                  {/* Geofence specs */}
                  <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white/5 rounded-lg p-2">
                      <span className="block text-slate-400 text-[10px]">Alert Radius</span>
                      <span className="font-bold text-white text-sm">1.0 km</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <span className="block text-slate-400 text-[10px]">Distance to Zone</span>
                      <span className="font-bold text-emerald-400 text-sm">240 meters</span>
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center">
                      <Radio className="w-4 h-4 text-brand-600 mr-1.5" /> High-Accuracy GPS
                    </span>
                    <span className="font-semibold text-slate-800">± 8m precision</span>
                  </div>

                  {/* Distance Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>Approaching Geofence</span>
                      <span className="font-bold text-brand-600">82%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-brand-500 to-emerald-500 h-2.5 rounded-full w-[82%]"></div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="font-medium">Synthesized sound alert armed & ready to chime</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Effortless 3-Step Setup
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-navy-950">
              How GeoAlarm Keeps You on Track
            </p>
            <p className="text-slate-600">
              Whether you are taking a nap on the commuter bus or reading on the train, you will arrive on time.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-brand-300 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xl mb-6">
                1
              </div>
              <h3 className="text-xl font-bold text-navy-950 mb-2">Pick Your Destination</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Search for your station, stop, or drop-off location, or click directly anywhere on the interactive Leaflet map to drop a pin.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-brand-300 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl mb-6 shadow-md shadow-brand-500/20">
                2
              </div>
              <h3 className="text-xl font-bold text-navy-950 mb-2">Select Wake-Up Radius</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Choose your alert boundary: <strong>500m</strong> for walking/city buses, <strong>1km or 2km</strong> for subways, or <strong>5km</strong> for high-speed express routes.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-brand-300 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl mb-6">
                3
              </div>
              <h3 className="text-xl font-bold text-navy-950 mb-2">Rest & Arrive Safely</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Relax! As soon as your device crosses your target geofence, GeoAlarm sounds a ringing alarm and fires a desktop notification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Core Capabilities
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-navy-950">
              Designed For Real-World Travellers
            </p>
            <p className="text-slate-600">
              Built with modern web technologies that prioritize battery efficiency and prompt alerts.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Live Haversine Tracking</h4>
              <p className="text-slate-600 text-sm">
                Real-time mathematical distance calculation between your current GPS coordinates and destination with millisecond responsiveness.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Volume2 className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Web Audio Synth Chime</h4>
              <p className="text-slate-600 text-sm">
                Built-in synthetic audio buzzer that never fails due to missing audio assets or broken file downloads.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Web Notifications API</h4>
              <p className="text-slate-600 text-sm">
                Desktop and browser notifications that show up prominently the moment you enter your wake-up circle.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <Radio className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Multiple Radius Presets</h4>
              <p className="text-slate-600 text-sm">
                Quick 500m, 1km, 2km, and 5km radius presets with interactive visual feedback directly on the Leaflet map.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Zero Paid API Dependencies</h4>
              <p className="text-slate-600 text-sm">
                Completely powered by Leaflet and OpenStreetMap tiles. No Google Maps billing or unexpected credit card charges.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-navy-950 mb-2">Mobile & Desktop Friendly</h4>
              <p className="text-slate-600 text-sm">
                Responsive layouts designed specifically to work smoothly across laptops, tablets, and mobile phones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-navy-900 py-16 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Travel Stress-Free?
          </h2>
          <p className="text-slate-300 text-base max-w-xl mx-auto">
            Set up your first location alarm in less than 30 seconds. No setup fees, no tracking ads, no hassle.
          </p>
          <div>
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-navy-950 bg-white hover:bg-slate-100 rounded-xl shadow-lg transition-transform hover:scale-105"
            >
              <span>{isAuthenticated ? 'Open My Dashboard' : 'Create Free Account'}</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
