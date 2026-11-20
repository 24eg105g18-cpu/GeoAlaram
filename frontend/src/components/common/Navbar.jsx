import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Bell, Menu, X, LogOut, Compass, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-[#0B1020]/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:shadow-purple-500/30 group-hover:scale-105 transition-all duration-200">
              <div className="relative">
                <MapPin className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse border-2 border-[#0B1020]"></span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-[#F8FAFC] font-sans">
                Geo<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]">Alarm</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-400 -mt-1">
                Smart Geofence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-7">
            <Link
              to="/"
              className={`relative text-sm font-medium py-1 transition-colors ${
                isActive('/') ? 'text-[#F8FAFC] font-semibold' : 'text-slate-400 hover:text-[#F8FAFC]'
              }`}
            >
              Home
              {isActive('/') && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
              )}
            </Link>

            <a
              href="/#how-it-works"
              className="text-sm font-medium text-slate-400 hover:text-[#F8FAFC] transition-colors"
            >
              How It Works
            </a>

            <a
              href="/#features"
              className="text-sm font-medium text-slate-400 hover:text-[#F8FAFC] transition-colors"
            >
              Features
            </a>

            {isAuthenticated ? (
              <div className="flex items-center space-x-4 pl-4 border-l border-white/10">
                <Link
                  to="/dashboard"
                  className={`relative inline-flex items-center space-x-1.5 text-sm font-medium py-1 transition-colors ${
                    isActive('/dashboard')
                      ? 'text-[#3B82F6] font-semibold'
                      : 'text-slate-300 hover:text-[#3B82F6]'
                  }`}
                >
                  <Compass className="w-4 h-4 text-[#3B82F6]" />
                  <span>Dashboard</span>
                  {isActive('/dashboard') && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                  )}
                </Link>

                <Link
                  to="/alarms"
                  className={`relative inline-flex items-center space-x-1.5 text-sm font-medium py-1 transition-colors ${
                    isActive('/alarms')
                      ? 'text-[#8B5CF6] font-semibold'
                      : 'text-slate-300 hover:text-[#8B5CF6]'
                  }`}
                >
                  <Bell className="w-4 h-4 text-[#8B5CF6]" />
                  <span>My Alarms</span>
                  {isActive('/alarms') && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#8B5CF6] rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
                  )}
                </Link>

                <Link
                  to="/alarms/create"
                  className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-blue-500 hover:to-purple-500 rounded-lg shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>New Alarm</span>
                </Link>

                <Link
                  to="/profile"
                  className={`flex items-center space-x-2 bg-[#151C2E] border rounded-full py-1 px-3 transition-all ${
                    isActive('/profile')
                      ? 'border-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.35)]'
                      : 'border-white/10 hover:border-purple-500/40'
                  }`}
                  title="View Profile Settings"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 max-w-[110px] truncate">
                    {user?.name || 'Profile'}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 pl-4 border-l border-white/10">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-300 hover:text-[#F8FAFC] px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-blue-500 hover:to-purple-500 rounded-lg shadow-md shadow-blue-500/25 transition-all hover:scale-105"
                >
                  Get Started Free
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#0B1020]/95 backdrop-blur-2xl px-4 pt-3 pb-6 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-base font-medium transition-colors ${
              isActive('/')
                ? 'bg-gradient-to-r from-[#3B82F6]/20 to-[#8B5CF6]/20 text-[#F8FAFC] font-semibold border-l-2 border-[#3B82F6]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            Home
          </Link>
          <a
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            How It Works
          </a>
          <a
            href="/#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            Features
          </a>

          {isAuthenticated ? (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-[#3B82F6]/15 text-[#3B82F6] border-l-2 border-[#3B82F6]'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/alarms"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/alarms')
                    ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-l-2 border-[#8B5CF6]'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                My Alarms
              </Link>
              <Link
                to="/alarms/create"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:bg-white/5"
              >
                Create New Alarm
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/profile')
                    ? 'bg-purple-500/15 text-[#8B5CF6] border-l-2 border-[#8B5CF6]'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                Profile & Settings
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-white/10 flex flex-col space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-medium text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-xl shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
