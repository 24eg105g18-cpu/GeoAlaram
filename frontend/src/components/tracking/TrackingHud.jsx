import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Square,
  Compass,
  MapPin,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useTracking } from '../../context/TrackingContext';
import { formatDistance } from '../../utils/haversine';
import { unlockAudio } from '../../utils/sound';

export const TrackingHud = ({ alarms = [] }) => {
  const {
    isTracking,
    currentLocation,
    nearestAlarm,
    trackingError,
    notificationPermission,
    requestNotificationPermission,
    startTracking,
    stopTracking,
    simulateAlarmArrival,
    syncAlarms,
  } = useTracking();

  // Active alarms from props
  const activeAlarms = alarms.filter((a) => a && a.status === 'active');

  // Synchronize alarms with TrackingContext whenever alarms change
  useEffect(() => {
    syncAlarms(alarms);
  }, [alarms, syncAlarms]);

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      unlockAudio(); // Prime audio engine on user start gesture
      if (activeAlarms.length === 0) {
        alert('Please create or resume an active alarm before starting GPS monitoring.');
        return;
      }
      startTracking(activeAlarms);
    }
  };

  // Helper to reliably test simulation of arriving inside the target alarm's geofence
  const handleSimulateArrival = async () => {
    console.log('[TrackingHud] "Simulate Arrival" button clicked.');
    unlockAudio(); // Immediately unlock AudioContext synchronously on user click gesture
    console.log(`[TrackingHud] Notification permission state before simulation: "${notificationPermission}"`);

    // If permission is still default, request permission now within this user gesture
    if (notificationPermission === 'default') {
      console.log('[TrackingHud] Prompting user for Notification permission during simulation click...');
      await requestNotificationPermission();
    } else if (notificationPermission === 'denied') {
      console.warn(
        '[TrackingHud] Note: Chrome notifications are currently blocked in site settings. ' +
        'In-app modal and audio chime will trigger, but Chrome will suppress desktop banners until unblocked in site settings.'
      );
    }

    // Select target: prefer currently closest active alarm, fallback to first active alarm in list
    let target = null;
    if (nearestAlarm?.alarm && nearestAlarm.alarm.status === 'active') {
      target = nearestAlarm.alarm;
    } else if (activeAlarms.length > 0) {
      target = activeAlarms[0];
    }

    if (!target) {
      console.warn('[TrackingHud] Cannot simulate: No active alarms available.', { activeAlarmsCount: activeAlarms.length });
      alert('Please create or resume an alarm first before simulating arrival.');
      return;
    }

    console.log(`[TrackingHud] Targeting alarm: "${target.name}" (ID: ${target._id}) with radius ${target.radius}m`);

    // Execute safe arrival simulation
    const success = await simulateAlarmArrival(target);
    if (!success) {
      console.warn('[TrackingHud] Simulation did not complete successfully.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isTracking ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
            }`}
          ></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-navy-950">
                Foreground Location Monitor
              </h3>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isTracking
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isTracking ? 'Tracking Active' : 'Standby'}
              </span>

              {/* Notification Status Pill */}
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : notificationPermission === 'denied'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
                title={`Browser Notification Permission: ${notificationPermission}`}
              >
                <Bell className="w-3 h-3 mr-1 inline" />
                <span>
                  {notificationPermission === 'granted'
                    ? 'Notifications On'
                    : notificationPermission === 'denied'
                    ? 'Notifications Blocked'
                    : 'Notifications Off'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous GPS monitoring via <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">navigator.geolocation.watchPosition</code>
            </p>
          </div>
        </div>

        {/* Start / Stop Tracking Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleToggleTracking}
            disabled={!isTracking && activeAlarms.length === 0}
            title={!isTracking && activeAlarms.length === 0 ? 'Create or resume an active alarm to start monitoring' : ''}
            className={`inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isTracking
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {isTracking ? (
              <>
                <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                <span>Stop Monitoring</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                <span>Start Monitoring GPS</span>
              </>
            )}
          </button>

          {/* Simulated GPS Trigger Test */}
          <button
            type="button"
            onClick={handleSimulateArrival}
            disabled={activeAlarms.length === 0}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 disabled:opacity-40 transition-colors shadow-sm"
            title="Simulate entering geofence radius to test alarm alert immediately"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-brand-600" />
            <span>Simulate Arrival</span>
          </button>
        </div>
      </div>

      {/* Notification Guidance Banners */}
      {notificationPermission === 'default' && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <Bell className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>Enable Chrome Notifications:</strong> Allow browser alerts so GeoAlarm can pop up desktop banners when arriving at destinations.
            </span>
          </div>
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors flex-shrink-0 self-start sm:self-auto"
          >
            Allow Notifications
          </button>
        </div>
      )}

      {notificationPermission === 'denied' && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Desktop Notifications Blocked in Chrome Settings</span>
            <p className="text-amber-800 leading-relaxed">
              Google Chrome is currently blocking notifications for this page. To allow them, click the <strong>site settings / padlock icon</strong> on the left side of your browser address bar and change <strong>Notifications</strong> to <strong>Allow</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Tracking Error Banner */}
      {trackingError && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-medium">{trackingError}</span>
        </div>
      )}

      {/* Telemetry Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* GPS Coordinates */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Current GPS Position
          </span>
          {currentLocation ? (
            <div className="space-y-0.5">
              <p className="font-mono text-xs font-bold text-slate-800">
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                Accuracy: ±{Math.round(currentLocation.accuracy || 10)}m
                {currentLocation.simulated && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-brand-100 text-brand-800 text-[9px] uppercase font-bold">
                    Simulated
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {isTracking ? 'Acquiring GPS fix...' : 'Tracking not started'}
            </p>
          )}
        </div>

        {/* Nearest Destination */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Nearest Active Alarm Geofence
          </span>
          {nearestAlarm ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="truncate">
                <p className="text-xs font-bold text-navy-950 truncate">
                  {nearestAlarm.alarm.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {nearestAlarm.alarm.destinationName}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-xs font-extrabold text-brand-600 block">
                  {formatDistance(nearestAlarm.distance)} away
                </span>
                <span className="text-[10px] text-slate-400">
                  Wake radius: {formatDistance(nearestAlarm.alarm.radius)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {activeAlarms.length === 0
                ? 'No active alarms. Create or resume an alarm to start monitoring.'
                : 'Monitoring proximity...'}
            </p>
          )}
        </div>
      </div>

      {/* Important Foreground Disclaimer */}
      <div className="flex items-start space-x-2 text-[11px] text-slate-500 bg-brand-50/50 p-3 rounded-xl border border-brand-100">
        <Info className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Foreground Tracking Notice:</strong> Web browsers only maintain GPS location checks while this browser tab remains active and open in the foreground. Keep this tab open on your device while travelling.
        </p>
      </div>
    </div>
  );
};

export default TrackingHud;
