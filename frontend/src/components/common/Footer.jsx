import React from 'react';
import { MapPin, Navigation, ShieldCheck, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-navy-950 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                Geo<span className="text-brand-400">Alarm</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Smart location-based alarms for commuters and travellers. Set your destination, choose a radius, and rest easy knowing you will never miss your stop again.
            </p>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Free & Open Source Map Data via OpenStreetMap & Leaflet</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
              Application
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-white transition-colors">
                  Sign In
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-white transition-colors">
                  Create Account
                </a>
              </li>
            </ul>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
              Powered By
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">React 18</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">Vite</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">Tailwind CSS</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">Node / Express</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">MongoDB</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">Leaflet</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-4 sm:space-y-0">
          <p>© {new Date().getFullYear()} GeoAlarm. Designed for travellers worldwide.</p>
          <div className="flex items-center space-x-1">
            <span>Built with precision for real-world commutes</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
