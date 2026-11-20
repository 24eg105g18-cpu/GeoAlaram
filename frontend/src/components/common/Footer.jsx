import React from 'react';
import { MapPin, ShieldCheck, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-[#0B1020] text-slate-400 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#F8FAFC] font-sans">
                Geo<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]">Alarm</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Smart location-based alarms for commuters and travellers. Set your destination, choose a radius, and rest easy knowing you will never miss your stop again.
            </p>
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-[#151C2E] border border-white/10 rounded-xl p-2.5 max-w-md">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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
                <a href="/#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-white transition-colors">
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
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-blue-500/40 transition-colors">React 18</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-purple-500/40 transition-colors">Vite</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-blue-500/40 transition-colors">Tailwind CSS</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-purple-500/40 transition-colors">Node / Express</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-blue-500/40 transition-colors">MongoDB</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#151C2E] border border-white/10 text-slate-300 font-mono hover:border-purple-500/40 transition-colors">Leaflet</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-4 sm:space-y-0">
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
