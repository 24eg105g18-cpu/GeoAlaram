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
  LogOut,
  User,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { alarmService } from '../services/alarmService';
import TrackingHud from '../components/tracking/TrackingHud';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-navy-900 to-brand-600 flex items-center justify-center text-white shadow-sm">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-navy-950 font-sans">
                Geo<span className="text-brand-600">Alarm</span>
              </span>
            </Link>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2.5 px-3 py-1.5 bg-slate-100 rounded-full">
                <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  {user?.name || 'Traveller'}
                </span>
              </div>

              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-white/10 text-brand-300 text-xs font-medium mb-3">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Smart Travel Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Traveller'}!
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Monitor your active alarms or create a new geofenced wake-up boundary for your upcoming trip.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/alarms/create"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-md transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Create New Alarm</span>
            </Link>
            <button
              onClick={fetchAlarms}
              disabled={isLoading}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title="Refresh Alarms"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Foreground Location Monitoring HUD */}
        <TrackingHud alarms={alarms} />

        {/* Action / Error Alerts */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Alarms</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-navy-950 mt-3">{stats.total}</p>
            <p className="text-xs text-slate-400 mt-1">Configured destinations</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Alarms</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-3">{stats.active}</p>
            <p className="text-xs text-slate-400 mt-1">Currently armed & tracking</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Paused Alarms</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Pause className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-3">{stats.paused}</p>
            <p className="text-xs text-slate-400 mt-1">Temporarily muted</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Completed</span>
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-600 mt-3">{stats.completed}</p>
            <p className="text-xs text-slate-400 mt-1">Triggered destinations</p>
          </div>
        </div>

        {/* Saved Alarms List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Your Saved Location Alarms</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Alarms saved to your account. Active alarms are continuously tracked while the tab is open.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="font-medium text-slate-500">
                Showing {alarms.length} {alarms.length === 1 ? 'alarm' : 'alarms'}
              </span>
              <Link
                to="/alarms"
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center"
              >
                <span>Manage All</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm font-medium text-slate-600">Loading your saved alarms...</p>
            </div>
          ) : alarms.length === 0 ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-navy-950">No alarms set yet</h3>
              <p className="text-sm text-slate-500">
                You haven't created any location-based alarms yet. Add your first stop to stay alert during your commute.
              </p>
              <Link
                to="/alarms/create"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Your First Alarm</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alarms.map((alarm) => (
                <div key={alarm._id} className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Alarm Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-navy-950">{alarm.name}</h4>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            alarm.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : alarm.status === 'paused'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-brand-100 text-brand-800 border border-brand-200'
                          }`}
                        >
                          {alarm.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 flex items-center">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
                        <span className="truncate">{alarm.destinationName}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                        <span className="inline-flex items-center font-medium bg-slate-100 px-2 py-0.5 rounded">
                          Radius: {alarm.radius >= 1000 ? `${alarm.radius / 1000} km` : `${alarm.radius}m`}
                        </span>
                        <span>
                          Lat: {alarm.latitude.toFixed(4)}, Lon: {alarm.longitude.toFixed(4)}
                        </span>
                        {alarm.triggeredAt && (
                          <span className="text-brand-600 font-medium">
                            Arrived at {new Date(alarm.triggeredAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      <button
                        onClick={() => handleStatusToggle(alarm._id, alarm.status)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          alarm.status === 'active'
                            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
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
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
    </div>
  );
};

export default DashboardPage;
