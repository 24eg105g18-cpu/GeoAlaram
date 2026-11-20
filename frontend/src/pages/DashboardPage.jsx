import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Bell,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle,
  Clock,
  Compass,
  AlertCircle,
  RefreshCw,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { alarmService } from '../services/alarmService';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import TrackingHud from '../components/tracking/TrackingHud';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { resetAlarmTriggerLock, isTracking, startTracking } = useTracking();
  const navigate = useNavigate();

  const [alarms, setAlarms] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchAlarms = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await alarmService.getAlarms();
      if (data.success) {
        setAlarms(data.alarms);
        setStats(data.stats || { total: 0, active: 0, paused: 0, completed: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load alarms.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();

    // Refresh alarms immediately when an alarm is completed via modal dismissal
    const handleAlarmCompleted = () => {
      console.log('[DashboardPage] Alarm completed event received. Refreshing alarms...');
      fetchAlarms();
    };

    window.addEventListener('geoalarm:alarm-completed', handleAlarmCompleted);
    return () => {
      window.removeEventListener('geoalarm:alarm-completed', handleAlarmCompleted);
    };
  }, []);

  const handleStatusToggle = async (alarmId, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
      const res = await alarmService.updateStatus(alarmId, nextStatus);
      if (res.success) {
        if (nextStatus === 'active') {
          resetAlarmTriggerLock(alarmId);
          if (!isTracking) {
            startTracking();
          }
        }
        setActionSuccess(`Alarm ${nextStatus === 'active' ? 'resumed' : 'paused'} successfully.`);
        fetchAlarms();
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update alarm status.');
    }
  };

  const handleDelete = async (alarmId) => {
    if (!window.confirm('Are you sure you want to delete this alarm?')) {
      return;
    }

    try {
      const res = await alarmService.deleteAlarm(alarmId);
      if (res.success) {
        setActionSuccess('Alarm deleted successfully.');
        fetchAlarms();
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete alarm.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#3B82F6] selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#151C2E] via-[#1A233A] to-[#151C2E] rounded-3xl p-6 sm:p-8 border border-[#2A364F] shadow-2xl shadow-black/30">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-gradient-to-br from-[#3B82F6]/15 to-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1E273E] border border-[#2A364F] text-xs font-semibold text-[#3B82F6] shadow-sm">
                <Radio className="w-3.5 h-3.5 text-[#22C55E] animate-pulse" />
                <span>Smart Travel Command Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#F8FAFC]">
                Welcome back,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] via-indigo-400 to-[#8B5CF6]">
                  {user?.name || 'Traveller'}
                </span>
                !
              </h1>
              <p className="text-[#94A3B8] text-sm max-w-xl leading-relaxed">
                Monitor your active geofences in real time or configure a new destination alarm for your journey.
              </p>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0">
              <Link
                to="/alarms/create"
                className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-purple-500/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span>Create New Alarm</span>
              </Link>
              <button
                onClick={fetchAlarms}
                disabled={isLoading}
                className="p-3 bg-[#1E273E] hover:bg-[#2A364F] border border-[#2A364F] text-[#F8FAFC] rounded-xl transition-all shadow-sm disabled:opacity-50 hover:border-slate-600"
                title="Refresh Alarms"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#3B82F6]' : 'text-slate-300'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Foreground Location Monitoring HUD */}
        <TrackingHud alarms={alarms} />

        {/* Action / Error Alerts */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-2.5 animate-fadeIn shadow-sm">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Total Alarms */}
          <div className="bg-[#151C2E] p-5 sm:p-6 rounded-2xl border border-[#2A364F] shadow-lg shadow-black/20 hover:border-[#3B82F6]/50 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Total Alarms
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#1E273E] border border-[#2A364F] text-[#3B82F6] flex items-center justify-center shadow-inner">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] mt-3 tracking-tight">
              {stats.total}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Configured destinations</p>
          </div>

          {/* Card 2: Active Alarms */}
          <div className="bg-[#151C2E] p-5 sm:p-6 rounded-2xl border border-[#2A364F] shadow-lg shadow-black/20 hover:border-emerald-500/50 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
                Active Alarms
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-3 tracking-tight">
              {stats.active}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Currently armed & tracking</p>
          </div>

          {/* Card 3: Paused Alarms */}
          <div className="bg-[#151C2E] p-5 sm:p-6 rounded-2xl border border-[#2A364F] shadow-lg shadow-black/20 hover:border-amber-500/50 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Paused Alarms
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
                <Pause className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-3 tracking-tight">
              {stats.paused}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Temporarily muted</p>
          </div>

          {/* Card 4: Completed Alarms */}
          <div className="bg-[#151C2E] p-5 sm:p-6 rounded-2xl border border-[#2A364F] shadow-lg shadow-black/20 hover:border-[#8B5CF6]/50 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">
                Completed
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-950/50 border border-purple-500/30 text-[#8B5CF6] flex items-center justify-center shadow-inner">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#8B5CF6] mt-3 tracking-tight">
              {stats.completed}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Triggered destinations</p>
          </div>
        </div>

        {/* Saved Alarms Overview Section */}
        <div className="bg-[#151C2E] rounded-3xl border border-[#2A364F] shadow-xl shadow-black/20 overflow-hidden">
          {/* Section Header */}
          <div className="p-6 border-b border-[#2A364F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#F8FAFC] tracking-tight">
                Your Saved Location Alarms
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Alarms saved to your account. Active alarms are continuously tracked while the tab is open.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="font-medium text-[#94A3B8] bg-[#1E273E] px-3 py-1 rounded-full border border-[#2A364F]">
                Showing {alarms.length} {alarms.length === 1 ? 'alarm' : 'alarms'}
              </span>
              <Link
                to="/alarms"
                className="font-bold text-[#3B82F6] hover:text-[#8B5CF6] transition-colors flex items-center"
              >
                <span>Manage All</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>

          {/* Section Body */}
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500/20 border-t-[#3B82F6] border-r-[#8B5CF6] rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-medium text-[#94A3B8]">Loading your saved alarms...</p>
            </div>
          ) : alarms.length === 0 ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E273E] border border-[#2A364F] text-[#3B82F6] flex items-center justify-center mx-auto shadow-inner">
                <MapPin className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">No alarms set yet</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                You haven't created any location-based alarms yet. Add your first destination to stay alert during your commute.
              </p>
              <Link
                to="/alarms/create"
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Your First Alarm</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#2A364F]/60">
              {alarms.map((alarm) => (
                <div
                  key={alarm._id}
                  className="p-5 sm:p-6 hover:bg-[#1E273E]/40 transition-colors duration-150"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Alarm Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2.5">
                        <h4 className="text-base font-bold text-[#F8FAFC] tracking-tight">
                          {alarm.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            alarm.status === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(34,197,94,0.15)]'
                              : alarm.status === 'paused'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                              : 'bg-purple-950/60 text-[#8B5CF6] border border-purple-500/40'
                          }`}
                        >
                          {alarm.status}
                        </span>
                      </div>

                      <p className="text-xs text-[#94A3B8] flex items-center">
                        <MapPin className="w-3.5 h-3.5 text-[#3B82F6] mr-1.5 flex-shrink-0" />
                        <span className="truncate">{alarm.destinationName}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#94A3B8] pt-1">
                        <span className="inline-flex items-center font-medium bg-[#1E273E] border border-[#2A364F] px-2.5 py-0.5 rounded-lg text-slate-200">
                          Radius: {alarm.radius >= 1000 ? `${alarm.radius / 1000} km` : `${alarm.radius}m`}
                        </span>
                        <span className="font-mono text-[11px] text-[#94A3B8] bg-[#0B1020]/70 px-2 py-0.5 rounded border border-[#2A364F]/60">
                          Lat: {alarm.latitude.toFixed(4)}, Lon: {alarm.longitude.toFixed(4)}
                        </span>
                        {alarm.triggeredAt && (
                          <span className="text-[#8B5CF6] font-medium flex items-center bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                            <Clock className="w-3 h-3 mr-1" />
                            Arrived at {new Date(alarm.triggeredAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      <button
                        onClick={() => handleStatusToggle(alarm._id, alarm.status)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
                          alarm.status === 'active'
                            ? 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 hover:border-amber-400'
                            : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-400'
                        }`}
                        title={alarm.status === 'active' ? 'Pause Alarm' : 'Resume Alarm'}
                      >
                        {alarm.status === 'active' ? (
                          <>
                            <Pause className="w-3.5 h-3.5 mr-1" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(alarm._id)}
                        className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 hover:border hover:border-rose-500/30 transition-all"
                        title="Delete Alarm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default DashboardPage;
