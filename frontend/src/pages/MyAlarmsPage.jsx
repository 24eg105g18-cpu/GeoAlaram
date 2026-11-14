import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Bell,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Compass,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  ArrowRight,
  Radio,
} from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { alarmService } from '../services/alarmService';
import { useTracking } from '../context/TrackingContext';
import { formatDistance } from '../utils/haversine';

export const MyAlarmsPage = () => {
  const [alarms, setAlarms] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, paused, completed
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal State
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    destinationName: '',
    latitude: '',
    longitude: '',
    radius: 1000,
    status: 'active',
    notes: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Modal State
  const [deletingAlarm, setDeletingAlarm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { startTracking, isTracking, resetAlarmTriggerLock } = useTracking();

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

    const handleAlarmCompleted = () => {
      console.log('[MyAlarmsPage] Alarm completed event received. Refreshing alarms...');
      fetchAlarms();
    };

    window.addEventListener('geoalarm:alarm-completed', handleAlarmCompleted);
    return () => {
      window.removeEventListener('geoalarm:alarm-completed', handleAlarmCompleted);
    };
  }, []);

  // Filter and search alarms in real-time
  const filteredAlarms = useMemo(() => {
    return alarms.filter((alarm) => {
      // Status filter
      if (statusFilter !== 'all' && alarm.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = alarm.name.toLowerCase().includes(query);
        const destMatch = alarm.destinationName.toLowerCase().includes(query);
        return nameMatch || destMatch;
      }
      return true;
    });
  }, [alarms, statusFilter, searchQuery]);

  // Toggle Pause / Resume
  const handleToggleStatus = async (alarmId, currentStatus) => {
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

  // Open Edit Modal
  const openEditModal = (alarm) => {
    setEditingAlarm(alarm);
    setEditForm({
      name: alarm.name,
      destinationName: alarm.destinationName,
      latitude: alarm.latitude,
      longitude: alarm.longitude,
      radius: alarm.radius,
      status: alarm.status,
      notes: alarm.notes || '',
    });
    setEditError('');
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.destinationName.trim()) {
      setEditError('Alarm name and destination address are required.');
      return;
    }

    try {
      setIsUpdating(true);
      setEditError('');
      const res = await alarmService.updateAlarm(editingAlarm._id, {
        name: editForm.name.trim(),
        destinationName: editForm.destinationName.trim(),
        latitude: Number(editForm.latitude),
        longitude: Number(editForm.longitude),
        radius: Number(editForm.radius),
        status: editForm.status,
        notes: editForm.notes.trim(),
      });

      if (res.success) {
        if (editForm.status === 'active') {
          resetAlarmTriggerLock(editingAlarm._id);
          if (!isTracking) {
            startTracking();
          }
        }
        setActionSuccess('Alarm updated successfully.');
        setEditingAlarm(null);
        fetchAlarms();
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update alarm.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirm and Execute Delete
  const handleDeleteConfirm = async () => {
    if (!deletingAlarm) return;

    try {
      setIsDeleting(true);
      const res = await alarmService.deleteAlarm(deletingAlarm._id);
      if (res.success) {
        setActionSuccess('Alarm deleted successfully.');
        setDeletingAlarm(null);
        fetchAlarms();
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete alarm.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
              <Compass className="w-3.5 h-3.5" />
              <span>Alarm Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              My Location Alarms
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your destinations, adjust alert boundaries, or pause notifications.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/alarms/create"
              className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>New Alarm</span>
            </Link>

            <button
              onClick={fetchAlarms}
              disabled={isLoading}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-sm"
              title="Refresh Alarms"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action & Error Alerts */}
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

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'active', label: 'Active', count: stats.active },
              { id: 'paused', label: 'Paused', count: stats.paused },
              { id: 'completed', label: 'Completed', count: stats.completed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 opacity-75 font-mono text-[11px]">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by alarm or stop..."
              className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Alarms Content Grid */}
        {isLoading ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium text-slate-600">Loading alarms...</p>
          </div>
        ) : filteredAlarms.length === 0 ? (
          <div className="py-20 px-4 text-center bg-white rounded-2xl border border-slate-200 max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Bell className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-navy-950">No alarms found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No alarms matched "${searchQuery}". Try clearing your search term.`
                : statusFilter !== 'all'
                ? `No alarms currently have status "${statusFilter}".`
                : 'You have not set any location alarms yet.'}
            </p>
            <div>
              {searchQuery || statusFilter !== 'all' ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <Link
                  to="/alarms/create"
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Create First Alarm</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAlarms.map((alarm) => (
              <div
                key={alarm._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between space-y-4"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-navy-950 leading-snug line-clamp-1">
                      {alarm.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
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

                  <p className="text-xs text-slate-600 flex items-start">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{alarm.destinationName}</span>
                  </p>
                </div>

                {/* Specs Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Radius</span>
                    <span className="font-bold text-slate-800">{formatDistance(alarm.radius)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Created</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(alarm.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="col-span-2 text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/50">
                    GPS: {alarm.latitude.toFixed(4)}, {alarm.longitude.toFixed(4)}
                  </div>
                </div>

                {alarm.notes && (
                  <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    "{alarm.notes}"
                  </p>
                )}

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(alarm._id, alarm.status)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      alarm.status === 'active'
                        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
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

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(alarm)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit Alarm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingAlarm(alarm)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
      </main>

      {/* Edit Alarm Modal */}
      {editingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-navy-950">Edit Location Alarm</h3>
              <button
                onClick={() => setEditingAlarm(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alarm Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Address</label>
                <input
                  type="text"
                  required
                  value={editForm.destinationName}
                  onChange={(e) => setEditForm({ ...editForm, destinationName: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alert Radius</label>
                  <select
                    value={editForm.radius}
                    onChange={(e) => setEditForm({ ...editForm, radius: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs"
                  >
                    <option value={500}>500 meters</option>
                    <option value={1000}>1,000 meters (1 km)</option>
                    <option value={2000}>2,000 meters (2 km)</option>
                    <option value={5000}>5,000 meters (5 km)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Travel Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingAlarm(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-950">Delete Alarm?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong>"{deletingAlarm.name}"</strong>? This action cannot be undone.
            </p>
            <div className="pt-2 flex justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeletingAlarm(null)}
                className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Alarm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MyAlarmsPage;
