import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { calculateDistance, formatDistance } from '../utils/haversine';
import { startAlarmSound, stopAlarmSound, unlockAudio } from '../utils/sound';
import { alarmService } from '../services/alarmService';

const TrackingContext = createContext(null);

// Exactly 5 minutes in milliseconds (300,000 ms)
const SNOOZE_DURATION_MS = 5 * 60 * 1000;

// Geolocation options for high accuracy, fresh hardware fixes, and robust timeout (Requirements 2 & 4)
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30000,
};

const MAX_RESTART_ATTEMPTS = 5;

export const TrackingProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null); // { latitude, longitude, accuracy, timestamp }
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [nearestAlarm, setNearestAlarm] = useState(null); // { alarm, distance }
  const [trackingError, setTrackingError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Triggered alarm modal state
  const [triggeredAlarm, setTriggeredAlarm] = useState(null);

  // Refs to maintain state inside watchPosition callback & prevent stale closures
  const watchIdRef = useRef(null);
  const triggeredAlarmIdsRef = useRef(new Set());
  const activeAlarmsRef = useRef([]);
  const simulationLockUntilRef = useRef(0); // Timestamp lock to prevent real GPS from overwriting simulation
  const activeNotificationRef = useRef(null); // Ref to active browser Notification instance
  const autoStoppedRef = useRef(false); // Flag indicating GPS monitoring auto-stopped because 0 active alarms remained
  const syncAlarmsRef = useRef(null);

  // Snooze management refs (Requirement 1, 8, 9)
  const snoozedAlarmsRef = useRef(new Map()); // Map<alarmId (string), snoozeUntilTimestamp (number)>
  const snoozeTimersRef = useRef(new Map());  // Map<alarmId (string), timeoutId>

  // Fresh state refs to avoid stale closures in setTimeout callbacks
  const isTrackingRef = useRef(false);
  const currentLocationRef = useRef(null);
  const processLocationUpdateRef = useRef(null);
  const restartWatcherRef = useRef(null);

  // GPS Timeout Recovery & Stability Refs (Requirement 3 & 5)
  const consecutiveTimeoutsRef = useRef(0);
  const restartAttemptsRef = useRef(0);
  const watchRecoveryTimerRef = useRef(null);
  const transientEmptyTimerRef = useRef(null);

  // Keep refs synchronized with React state
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    activeAlarmsRef.current = activeAlarms;
  }, [activeAlarms]);

  /**
   * Clear snooze timer and record for a given alarm.
   * (Requirement 8)
   */
  const clearAlarmSnooze = useCallback((alarmId) => {
    const strId = String(alarmId);
    if (snoozeTimersRef.current.has(strId)) {
      clearTimeout(snoozeTimersRef.current.get(strId));
      snoozeTimersRef.current.delete(strId);
    }
    if (snoozedAlarmsRef.current.has(strId)) {
      snoozedAlarmsRef.current.delete(strId);
      console.log(`[GeoAlarm Snooze] Cleared snooze record for alarm ID: ${strId}`);
    }
  }, []);

  // Request browser Notification permission with robust cross-browser handling
  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[GeoAlarm Notification] Notification API is not supported in this browser.');
      return 'unsupported';
    }

    const currentPermission = Notification.permission;
    console.log(`[GeoAlarm Notification] Checking permission... Current: "${currentPermission}"`);

    if (currentPermission === 'granted') {
      setNotificationPermission('granted');
      return 'granted';
    }

    if (currentPermission === 'denied') {
      console.warn(
        '[GeoAlarm Notification] Notification permission is "denied" in site settings. ' +
        'To allow: Click the lock/tune icon in the address bar -> Permissions -> Notifications -> Allow.'
      );
      setNotificationPermission('denied');
      return 'denied';
    }

    try {
      console.log('[GeoAlarm Notification] Requesting notification permission from user...');
      let result;
      const permPromise = Notification.requestPermission();
      if (permPromise && typeof permPromise.then === 'function') {
        result = await permPromise;
      } else {
        result = await new Promise((resolve) => {
          Notification.requestPermission((p) => resolve(p));
        });
      }

      console.log(`[GeoAlarm Notification] User responded to permission prompt with: "${result}"`);
      setNotificationPermission(result);
      return result;
    } catch (err) {
      console.error('[GeoAlarm Notification] Notification permission request error:', err);
      setNotificationPermission(Notification.permission);
      return Notification.permission;
    }
  };

  // Fire Web Notification with unique tagging, renotify support, and active tracking
  const sendWebNotification = async (alarm, distance, isSimulation = false) => {
    // 1. Check API support
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[GeoAlarm Notification] Web Notifications API is not supported in this browser environment.');
      return null;
    }

    // 2. Check permission status
    let perm = Notification.permission;
    console.log(`[GeoAlarm Notification] Preparing to fire notification. Current permission: "${perm}"`);

    if (perm === 'default') {
      console.log('[GeoAlarm Notification] Permission is "default". Prompting user...');
      perm = await requestNotificationPermission();
    }

    if (perm !== 'granted') {
      if (perm === 'denied') {
        console.warn(
          '[GeoAlarm Notification] Cannot display notification: Permission is DENIED by user in Chrome site settings. ' +
          'Please click the lock/settings icon next to localhost:5173 -> Permissions -> Notifications -> Allow.'
        );
      } else {
        console.warn(`[GeoAlarm Notification] Cannot display notification: Permission is "${perm}".`);
      }
      return null;
    }

    // 3. Close any prior active notification so Chrome and Windows Action Center do not suppress or silently collapse repeated notifications
    if (activeNotificationRef.current) {
      try {
        console.log('[GeoAlarm Notification] Closing prior active notification before presenting new alert.');
        activeNotificationRef.current.close();
      } catch (err) {
        console.warn('[GeoAlarm Notification] Error closing previous notification:', err.message);
      }
      activeNotificationRef.current = null;
    }

    // 4. Construct title, tag, and notification options
    try {
      const title = isSimulation
        ? `🚨 [SIMULATION] Arrived at: ${alarm.name}!`
        : `🚨 Arrived at: ${alarm.name}!`;

      // Unique tag per trigger/simulation timestamp prevents Chrome from silently replacing notifications without alerting
      const notificationTag = isSimulation
        ? `geoalarm-sim-${alarm._id}-${Date.now()}`
        : `geoalarm-${alarm._id}-${Date.now()}`;

      // Use absolute URL for the notification icon (PNG preferred for Windows Action Center Toast compatibility)
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const iconUrl = origin ? `${origin}/icon.png` : '/icon.png';

      const options = {
        body: `You are inside your ${formatDistance(alarm.radius)} radius (${formatDistance(distance)} from ${alarm.destinationName}).`,
        icon: iconUrl,
        badge: iconUrl,
        tag: notificationTag,
        renotify: true, // Forces Chrome to re-alert, play sound, and display toast banner even if a tagged notification exists in tray
        requireInteraction: true, // Keeps notification active until dismissed
        silent: false,
      };

      console.log(`[GeoAlarm Notification] Dispatching Chrome notification with tag: "${notificationTag}"...`, options);
      const notification = new Notification(title, options);
      activeNotificationRef.current = notification;

      notification.onshow = () => {
        console.log(`[GeoAlarm Notification] Notification displayed on screen successfully! (Tag: ${notificationTag})`);
      };

      notification.onclick = () => {
        console.log('[GeoAlarm Notification] User clicked the notification. Focusing window.');
        try {
          window.focus();
        } catch (e) {
          // ignore
        }
        notification.close();
      };

      notification.onerror = (e) => {
        console.error('[GeoAlarm Notification] Notification object emitted error event:', e);
      };

      notification.onclose = () => {
        console.log(`[GeoAlarm Notification] Notification closed (Tag: ${notificationTag}).`);
        if (activeNotificationRef.current === notification) {
          activeNotificationRef.current = null;
        }
      };

      return notification;
    } catch (err) {
      console.error('[GeoAlarm Notification] Failed to instantiate new Notification():', err);
      return null;
    }
  };

  /**
   * Reset trigger lock for an alarm (e.g. when resumed or reactivated).
   * Also clears any active snooze for that alarm.
   */
  const resetAlarmTriggerLock = useCallback((alarmId) => {
    const strId = String(alarmId);
    clearAlarmSnooze(strId);
    if (triggeredAlarmIdsRef.current.has(strId)) {
      triggeredAlarmIdsRef.current.delete(strId);
      console.log(`[GeoAlarm] Reset trigger lock for reactivated alarm ID: ${strId}`);
    }
  }, [clearAlarmSnooze]);

  /**
   * Stop location monitoring and cleanup.
   * @param {boolean} isManual - true if initiated by user click; false if auto-stopped (0 alarms)
   */
  const stopTracking = useCallback((isManual = true) => {
    isTrackingRef.current = false;

    // Clear any pending recovery or transient empty timers (Requirement 3 & 5)
    if (watchRecoveryTimerRef.current) {
      clearTimeout(watchRecoveryTimerRef.current);
      watchRecoveryTimerRef.current = null;
    }
    if (transientEmptyTimerRef.current) {
      clearTimeout(transientEmptyTimerRef.current);
      transientEmptyTimerRef.current = null;
    }
    consecutiveTimeoutsRef.current = 0;
    restartAttemptsRef.current = 0;

    if (watchIdRef.current !== null) {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      console.log(`[GeoAlarm] Cleared GPS watcher ID: ${watchIdRef.current}`);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    stopAlarmSound();
    simulationLockUntilRef.current = 0;
    if (isManual) {
      autoStoppedRef.current = false;
    }
    console.log('[GeoAlarm] Foreground GPS tracking stopped.');
  }, []);

  /**
   * Trigger an alarm arrival event.
   * Requirement 4: Removed premature database completion from triggerAlarm().
   * The alarm status remains active until the user clicks "I Have Arrived (Dismiss)".
   */
  const triggerAlarm = useCallback(async (alarm, distance, isSimulation = false) => {
    const alarmId = String(alarm._id);

    // Duplicate-trigger check for real GPS events
    if (!isSimulation && triggeredAlarmIdsRef.current.has(alarmId)) {
      console.log(`[GeoAlarm GPS] Duplicate alert suppressed for alarm "${alarm.name}" (ID: ${alarmId}). Already triggered.`);
      return;
    }

    // For simulation or first real GPS entry, arm the lock
    triggeredAlarmIdsRef.current.add(alarmId);

    // Clear any prior snooze record for this alarm since it has now triggered
    clearAlarmSnooze(alarmId);

    console.log(
      `[GeoAlarm] ALARM TRIGGERED (${isSimulation ? 'SIMULATION' : 'REAL GPS'}): "${alarm.name}" at distance ${distance}m (radius: ${alarm.radius}m)`
    );

    // Set UI modal
    setTriggeredAlarm({
      ...alarm,
      currentDistance: distance,
      isSimulation,
    });

    // Start repeating chime sound
    startAlarmSound();

    // Fire Web Notification
    sendWebNotification(alarm, distance, isSimulation);

    // NOTE: Database status update to 'completed' is strictly performed when user clicks "I Have Arrived (Dismiss)", NOT here.
  }, [clearAlarmSnooze]);

  /**
   * Evaluate location coordinates against active alarms.
   * Requirement 2: Checks snooze expiry before triggering any alarm.
   * Requirement 7: If user exits geofence, handles re-entry cleanly without duplicate triggering while inside radius.
   * Requirement 4: Preserves hardware GPS timestamp and safely validates accuracy.
   */
  const processLocationUpdate = useCallback((lat, lon, accuracy, isSimulation = false, timestamp = null) => {
    const numLat = Number(lat);
    const numLon = Number(lon);

    if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
      console.warn('[GeoAlarm] Discarding invalid coordinates in processLocationUpdate:', { lat, lon });
      return;
    }

    // Safely parse accuracy: accept any valid numeric accuracy without discarding low-accuracy fixes
    const validAccuracy = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0
      ? accuracy
      : (accuracy !== null && accuracy !== undefined && Number.isFinite(Number(accuracy)) ? Number(accuracy) : null);

    // Hardware GPS timestamp or fallback to current wall-clock time (Requirement 4)
    const validTimestamp = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
      ? timestamp
      : Date.now();

    const coords = {
      latitude: numLat,
      longitude: numLon,
      accuracy: validAccuracy,
      timestamp: validTimestamp,
      simulated: isSimulation,
    };
    setCurrentLocation(coords);
    currentLocationRef.current = coords;

    const alarms = activeAlarmsRef.current;
    if (!alarms || alarms.length === 0) {
      setNearestAlarm(null);
      // Requirement 5: Do not auto-stop GPS tracking during transient location updates when alarms are empty
      return;
    }

    let minDistance = Infinity;
    let closest = null;
    const now = Date.now();

    alarms.forEach((alarm) => {
      if (alarm.status !== 'active') return;

      const aLat = Number(alarm.latitude);
      const aLon = Number(alarm.longitude);
      if (!Number.isFinite(aLat) || !Number.isFinite(aLon)) return;

      const distance = calculateDistance(numLat, numLon, aLat, aLon);
      if (!Number.isFinite(distance)) return;

      if (distance < minDistance) {
        minDistance = distance;
        closest = { alarm, distance };
      }

      const strId = String(alarm._id);
      const radius = Number(alarm.radius);

      // Check if user is inside the geofence radius
      if (distance <= radius) {
        // Requirement 2: Check snooze expiry before triggering an alarm
        const snoozeUntil = snoozedAlarmsRef.current.get(strId);
        if (snoozeUntil) {
          if (now < snoozeUntil) {
            const remainingSec = Math.ceil((snoozeUntil - now) / 1000);
            console.log(`[GeoAlarm Snooze] Alarm "${alarm.name}" is snoozed (${remainingSec}s remaining). Suppressing trigger.`);
            return;
          } else {
            // Snooze has expired
            console.log(`[GeoAlarm Snooze] Snooze window expired for alarm "${alarm.name}". Releasing snooze lock.`);
            clearAlarmSnooze(strId);
            triggeredAlarmIdsRef.current.delete(strId);
          }
        }

        triggerAlarm(alarm, distance, isSimulation);
      } else {
        // Requirement 7: User is outside geofence radius.
        // If alarm is not actively snoozed and was previously marked as triggered,
        // release the trigger lock so re-entering the geofence will trigger again cleanly.
        const snoozeUntil = snoozedAlarmsRef.current.get(strId);
        const isActivelySnoozed = snoozeUntil && now < snoozeUntil;

        if (!isActivelySnoozed && triggeredAlarmIdsRef.current.has(strId)) {
          triggeredAlarmIdsRef.current.delete(strId);
          console.log(`[GeoAlarm Geofence] User outside geofence for alarm "${alarm.name}" (${distance}m > ${radius}m). Re-armed for next entry.`);
        }
      }
    });

    setNearestAlarm(closest);
  }, [triggerAlarm, clearAlarmSnooze]);

  // Synchronously and reactively keep fresh ref to processLocationUpdate (Requirement 1)
  processLocationUpdateRef.current = processLocationUpdate;
  useEffect(() => {
    processLocationUpdateRef.current = processLocationUpdate;
  }, [processLocationUpdate]);

  /**
   * Geolocation position success handler.
   * Requirement 1: Uses processLocationUpdateRef.current to prevent stale closures.
   * Requirement 4: Forwards hardware position timestamp.
   */
  const handlePositionSuccess = useCallback((position) => {
    // Reset consecutive timeouts & restart counters on any successful position fix
    consecutiveTimeoutsRef.current = 0;
    restartAttemptsRef.current = 0;
    if (watchRecoveryTimerRef.current) {
      clearTimeout(watchRecoveryTimerRef.current);
      watchRecoveryTimerRef.current = null;
    }

    // If simulation is in progress, do not let real GPS overwrite it
    if (Date.now() < simulationLockUntilRef.current) {
      console.log('[GeoAlarm GPS] Real GPS event ignored while simulation alert is active.');
      return;
    }

    const { latitude, longitude, accuracy } = position.coords;
    const posTimestamp = position.timestamp || Date.now();
    setTrackingError('');
    processLocationUpdateRef.current?.(latitude, longitude, accuracy, false, posTimestamp);
  }, []);

  /**
   * Geolocation error handler with safe timeout recovery.
   * Requirement 3: Handles error.code === 3 (TIMEOUT) without permanently stalling tracking.
   */
  const handlePositionError = useCallback((error) => {
    console.warn('[GeoAlarm] Geolocation watch error:', error?.message, `(code: ${error?.code})`);

    if (error?.code === 1) {
      setTrackingError('Location permission was denied. Please allow location access in your browser to enable tracking.');
      stopTracking(true);
      return;
    }

    if (error?.code === 2) {
      setTrackingError('GPS position unavailable. Searching for satellite/network signal...');
      return;
    }

    if (error?.code === 3) {
      // Timeout code: do not assume the browser permanently stopped the watcher on the first timeout
      consecutiveTimeoutsRef.current += 1;
      setTrackingError('GPS signal timed out. Retrying in background...');
      console.log(`[GeoAlarm] Geolocation timeout #${consecutiveTimeoutsRef.current}`);

      // If 2 or more consecutive timeouts occur, the browser's position provider may be stalled.
      // Schedule a controlled restart if tracking is still intended.
      if (consecutiveTimeoutsRef.current >= 2 && isTrackingRef.current) {
        if (restartAttemptsRef.current < MAX_RESTART_ATTEMPTS) {
          if (!watchRecoveryTimerRef.current) {
            const backoffDelay = Math.min(2000 * Math.pow(1.5, restartAttemptsRef.current), 10000);
            console.log(`[GeoAlarm] Scheduling controlled watcher restart in ${backoffDelay}ms (Attempt ${restartAttemptsRef.current + 1}/${MAX_RESTART_ATTEMPTS})...`);
            watchRecoveryTimerRef.current = setTimeout(() => {
              watchRecoveryTimerRef.current = null;
              if (!isTrackingRef.current) return;
              restartAttemptsRef.current += 1;
              restartWatcherRef.current?.();
            }, backoffDelay);
          }
        } else {
          console.warn('[GeoAlarm] Maximum GPS restart attempts reached. Awaiting signal recovery.');
          setTrackingError('Weak GPS signal. Please move to an open area with clear sky view.');
        }
      }
    }
  }, [stopTracking]);

  /**
   * Controlled watcher restart for stalled geolocation providers.
   * Requirement 3: Prevents multiple simultaneous watchers by always clearing the previous watch first.
   */
  const restartWatcher = useCallback(() => {
    if (!isTrackingRef.current) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    console.log('[GeoAlarm] Executing controlled GPS watcher restart...');

    // 1. Cleanly clear existing watcher
    if (watchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {
        console.warn('[GeoAlarm] Error clearing prior watch during restart:', e);
      }
      watchIdRef.current = null;
    }

    // 2. Start fresh watcher
    try {
      const watchId = navigator.geolocation.watchPosition(
        handlePositionSuccess,
        handlePositionError,
        GEOLOCATION_OPTIONS
      );
      watchIdRef.current = watchId;
      console.log(`[GeoAlarm] Controlled restart succeeded (New Watch ID: ${watchId}).`);
    } catch (err) {
      console.error('[GeoAlarm] Failed to restart GPS watcher:', err);
      setTrackingError('Failed to restart GPS: ' + err.message);
    }
  }, [handlePositionSuccess, handlePositionError]);

  restartWatcherRef.current = restartWatcher;
  useEffect(() => {
    restartWatcherRef.current = restartWatcher;
  }, [restartWatcher]);

  /**
   * Start continuous location monitoring.
   */
  const startTracking = useCallback(async (alarmsList = null) => {
    setTrackingError('');
    unlockAudio(); // Prime AudioContext during user gesture for future arrival events

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setTrackingError('Geolocation is not supported by this browser.');
      return;
    }

    // Ask for notification permission early
    await requestNotificationPermission();

    // Fetch active alarms if not provided
    if (alarmsList && Array.isArray(alarmsList)) {
      syncAlarmsRef.current?.(alarmsList);
    } else {
      try {
        const data = await alarmService.getAlarms('active');
        if (data.success) {
          syncAlarmsRef.current?.(data.alarms);
        }
      } catch (err) {
        console.warn('[GeoAlarm] Could not refresh active alarms for tracking:', err.message);
      }
    }

    // If already tracking with an active watcher, don't create duplicate watchers
    if (watchIdRef.current !== null && isTracking) {
      console.log('[GeoAlarm] GPS monitoring is already active. Updated active alarms.');
      return;
    }

    // Clear any previous watcher to guarantee no duplicate watchers or memory leaks
    if (watchIdRef.current !== null) {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }

    // Clear any pending recovery mechanism
    if (watchRecoveryTimerRef.current) {
      clearTimeout(watchRecoveryTimerRef.current);
      watchRecoveryTimerRef.current = null;
    }
    consecutiveTimeoutsRef.current = 0;
    restartAttemptsRef.current = 0;
    autoStoppedRef.current = false;
    isTrackingRef.current = true;

    // Start watchPosition with high accuracy and 30s timeout (Requirement 2)
    try {
      const watchId = navigator.geolocation.watchPosition(
        handlePositionSuccess,
        handlePositionError,
        GEOLOCATION_OPTIONS
      );

      watchIdRef.current = watchId;
      setIsTracking(true);
      console.log(`[GeoAlarm] Foreground GPS tracking started (Watch ID: ${watchId}).`);
    } catch (err) {
      setTrackingError('Failed to initiate GPS monitoring: ' + err.message);
      setIsTracking(false);
      isTrackingRef.current = false;
    }
  }, [requestNotificationPermission, isTracking, handlePositionSuccess, handlePositionError]);

  /**
   * Synchronize active alarms with the latest alarm list from Dashboard/MyAlarms.
   * Requirement 3: syncAlarms must NEVER clear trigger locks for alarms currently in their snooze window.
   * Requirement 8: Clears snooze timers and records for any alarms no longer active (paused, completed, deleted).
   * Requirement 5: Guards against transient empty alarm lists during loading / refresh operations.
   */
  const syncAlarms = useCallback((allAlarms = []) => {
    if (!Array.isArray(allAlarms)) return;

    // Requirement 5: If allAlarms is empty while tracking is active and we already have active alarms tracked,
    // this is a transient loading or refresh state (e.g. DashboardPage fetchAlarms in progress).
    // Do NOT wipe out existing active alarms or kill GPS tracking.
    if (allAlarms.length === 0 && isTrackingRef.current && activeAlarmsRef.current.length > 0) {
      console.log('[GeoAlarm Sync] Transient empty alarm list received while actively tracking. Scheduling verification...');
      if (!transientEmptyTimerRef.current) {
        transientEmptyTimerRef.current = setTimeout(() => {
          transientEmptyTimerRef.current = null;
          // If still tracking and active alarms list is now genuinely empty, auto-stop
          if (isTrackingRef.current && activeAlarmsRef.current.length === 0) {
            console.log('[GeoAlarm Sync] Verified no active alarms remaining. Auto-stopping GPS monitoring...');
            autoStoppedRef.current = true;
            stopTracking(false);
          }
        }, 1200);
      }
      return;
    }

    // A real alarms array arrived: clear any pending transient check timer
    if (transientEmptyTimerRef.current) {
      clearTimeout(transientEmptyTimerRef.current);
      transientEmptyTimerRef.current = null;
    }

    const filtered = allAlarms.filter((a) => a && a.status === 'active');
    setActiveAlarms(filtered);
    activeAlarmsRef.current = filtered;

    const now = Date.now();
    const activeIdSet = new Set(filtered.map((a) => String(a._id)));

    // Requirement 8: Clean up snooze for any alarms that are no longer active (paused, completed, deleted)
    for (const [snoozedId, timerId] of snoozeTimersRef.current.entries()) {
      if (!activeIdSet.has(snoozedId)) {
        console.log(`[GeoAlarm Snooze] Cleaning up snooze timer for non-active alarm ID: ${snoozedId}`);
        clearTimeout(timerId);
        snoozeTimersRef.current.delete(snoozedId);
        snoozedAlarmsRef.current.delete(snoozedId);
        triggeredAlarmIdsRef.current.delete(snoozedId);
      }
    }
    for (const snoozedId of snoozedAlarmsRef.current.keys()) {
      if (!activeIdSet.has(snoozedId)) {
        snoozedAlarmsRef.current.delete(snoozedId);
        triggeredAlarmIdsRef.current.delete(snoozedId);
      }
    }

    // Requirement 3: syncAlarms must NEVER clear trigger locks for alarms currently in their snooze window!
    filtered.forEach((alarm) => {
      const strId = String(alarm._id);
      const snoozeUntil = snoozedAlarmsRef.current.get(strId);
      if (snoozeUntil && now < snoozeUntil) {
        console.log(`[GeoAlarm Sync] Preserving trigger lock for actively snoozed alarm: "${alarm.name}" (${strId})`);
        return;
      }
    });

    // If tracking was previously auto-stopped because alarms reached 0,
    // and new/resumed active alarms are now detected, auto-resume GPS monitoring
    if (autoStoppedRef.current && filtered.length > 0 && !isTracking) {
      console.log(`[GeoAlarm Sync] Auto-restarting GPS monitoring for ${filtered.length} active alarm(s)...`);
      autoStoppedRef.current = false;
      startTracking(filtered);
    } else if (allAlarms.length > 0 && filtered.length === 0 && isTracking) {
      // Genuinely 0 active alarms (e.g. user paused all alarms or all are completed)
      console.log('[GeoAlarm Sync] No active alarms remaining in list. Auto-stopping GPS monitoring...');
      autoStoppedRef.current = true;
      stopTracking(false);
    }

    console.log(`[GeoAlarm Sync] Synchronized ${filtered.length} active alarms.`);
  }, [isTracking, startTracking, stopTracking]);

  useEffect(() => {
    syncAlarmsRef.current = syncAlarms;
  }, [syncAlarms]);

  /**
   * Dedicated method to safely simulate arriving at a target active alarm.
   * Guarantees numeric coordinates, clears prior snooze for explicit testing, and locks out real GPS interference.
   */
  const simulateAlarmArrival = useCallback(async (targetAlarm) => {
    if (!targetAlarm) {
      console.warn('[GeoAlarm Simulation] No target alarm provided for simulation.');
      return false;
    }

    unlockAudio(); // Immediately unlock AudioContext within the user click gesture before any async await

    const targetId = String(targetAlarm._id);
    console.log(`[GeoAlarm Simulation] Initiated simulation for alarm: "${targetAlarm.name}" (ID: ${targetId}, status: ${targetAlarm.status})`);

    // Ensure notification permission is requested during this user gesture if still 'default'
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      console.log('[GeoAlarm Simulation] Requesting notification permission during user simulation gesture...');
      await requestNotificationPermission();
    }

    const alarmLat = Number(targetAlarm.latitude);
    const alarmLon = Number(targetAlarm.longitude);
    const radius = Number(targetAlarm.radius) || 1000;

    if (!Number.isFinite(alarmLat) || !Number.isFinite(alarmLon)) {
      console.error('[GeoAlarm Simulation] Invalid coordinates on target alarm:', targetAlarm);
      alert('Selected alarm has invalid coordinates. Please edit and re-save it.');
      return false;
    }

    // Offset coordinates by ~11m (0.0001 deg), safely inside any geofence radius >= 50m
    const simLat = alarmLat + 0.0001;
    const simLon = alarmLon + 0.0001;

    const dist = calculateDistance(simLat, simLon, alarmLat, alarmLon);
    console.log(`[GeoAlarm Simulation] Simulated position: (${simLat.toFixed(5)}, ${simLon.toFixed(5)}) | Distance: ${dist}m | Radius: ${radius}m`);

    // Lock real GPS updates for 6 seconds so real GPS doesn't overwrite simulation state
    simulationLockUntilRef.current = Date.now() + 6000;

    // Reset snooze & lock for this specific alarm so simulation can be repeated on demand for testing
    clearAlarmSnooze(targetId);
    triggeredAlarmIdsRef.current.delete(targetId);

    // Update location telemetry state
    setCurrentLocation({
      latitude: simLat,
      longitude: simLon,
      accuracy: 5,
      timestamp: Date.now(),
      simulated: true,
    });

    // Directly trigger arrival alert for this specific alarm
    await triggerAlarm(targetAlarm, dist, true);
    return true;
  }, [triggerAlarm, requestNotificationPermission, clearAlarmSnooze]);

  /**
   * Dismiss triggered alarm modal and stop sound.
   * Marks the alarm completed in the database, removes it from active tracking immediately,
   * clears snooze state, and auto-stops GPS monitoring if 0 active alarms remain.
   * (Requirements 4, 8, 10)
   */
  const dismissAlarm = useCallback(async () => {
    stopAlarmSound();
    const targetAlarm = triggeredAlarm;
    setTriggeredAlarm(null);
    simulationLockUntilRef.current = 0;

    if (activeNotificationRef.current) {
      try {
        console.log('[GeoAlarm Notification] Closing browser notification on alarm dismissal.');
        activeNotificationRef.current.close();
      } catch (err) {
        console.warn('[GeoAlarm Notification] Error closing notification on dismissal:', err.message);
      }
      activeNotificationRef.current = null;
    }

    if (!targetAlarm) {
      console.log('[GeoAlarm] Alarm alert dismissed by user (no target alarm in state).');
      return;
    }

    const alarmId = String(targetAlarm._id);
    console.log(`[GeoAlarm] Alarm "${targetAlarm.name}" (ID: ${alarmId}) dismissed as "I Have Arrived".`);

    // Requirement 8: Clear any snooze state on dismissal
    clearAlarmSnooze(alarmId);
    triggeredAlarmIdsRef.current.delete(alarmId);

    // 1. Mark alarm as 'completed' in backend database
    try {
      await alarmService.updateStatus(alarmId, 'completed');
      console.log(`[GeoAlarm API] Alarm ${alarmId} status confirmed as 'completed' in database.`);
    } catch (err) {
      console.warn('[GeoAlarm API] Failed to update alarm status to completed on server:', err.message);
    }

    // 2. Remove completed alarm from active tracking state immediately
    const remainingActive = activeAlarmsRef.current.filter((a) => String(a._id) !== alarmId);
    setActiveAlarms(remainingActive);
    activeAlarmsRef.current = remainingActive;
    console.log(`[GeoAlarm] Active alarms remaining: ${remainingActive.length}`);

    // Update nearest alarm
    if (remainingActive.length === 0) {
      setNearestAlarm(null);
    } else if (currentLocationRef.current) {
      let minDistance = Infinity;
      let closest = null;
      const curLoc = currentLocationRef.current;
      remainingActive.forEach((alarm) => {
        const aLat = Number(alarm.latitude);
        const aLon = Number(alarm.longitude);
        if (Number.isFinite(aLat) && Number.isFinite(aLon)) {
          const dist = calculateDistance(curLoc.latitude, curLoc.longitude, aLat, aLon);
          if (dist < minDistance) {
            minDistance = dist;
            closest = { alarm, distance: dist };
          }
        }
      });
      setNearestAlarm(closest);
    }

    // 3 & 4. If no active alarms remain, stop GPS monitoring immediately
    if (remainingActive.length === 0) {
      console.log('[GeoAlarm Lifecycle] Zero active alarms remain. Auto-stopping GPS monitoring (clearing watcher)...');
      autoStoppedRef.current = true;
      stopTracking(false);
    } else {
      // 5. If other active alarms exist, continue GPS monitoring for those alarms
      console.log(`[GeoAlarm Lifecycle] ${remainingActive.length} active alarm(s) remain. GPS monitoring continues.`);
    }

    // Notify mounted pages (DashboardPage, MyAlarmsPage) to refresh their alarm data
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('geoalarm:alarm-completed', { detail: { alarmId } }));
    }
  }, [triggeredAlarm, stopTracking, clearAlarmSnooze]);

  /**
   * Snooze alarm for exactly 5 minutes (300,000 milliseconds).
   * Requirement 1: Timestamp-based snooze using snoozedAlarmsRef (Map) with 300,000 ms.
   * Requirement 5: Keeps alarm status active and does not stop GPS monitoring.
   * Requirement 6: When timer expires, immediately re-evaluates the latest known GPS position.
   * Requirement 9: Multiple alarms maintain independent snooze timers.
   */
  const snoozeAlarm = useCallback((alarmId) => {
    stopAlarmSound();
    setTriggeredAlarm(null);
    simulationLockUntilRef.current = 0;

    if (activeNotificationRef.current) {
      try {
        console.log('[GeoAlarm Notification] Closing browser notification on snooze.');
        activeNotificationRef.current.close();
      } catch (err) {
        console.warn('[GeoAlarm Notification] Error closing notification on snooze:', err.message);
      }
      activeNotificationRef.current = null;
    }

    const strId = String(alarmId);
    const snoozeDuration = SNOOZE_DURATION_MS; // 300,000 ms (5 minutes)
    const snoozeUntil = Date.now() + snoozeDuration;

    console.log(
      `[GeoAlarm Snooze] Snoozing alarm ${strId} for 5 minutes (300,000 ms). Will re-evaluate at ${new Date(snoozeUntil).toLocaleTimeString()}.`
    );

    // Clear any existing timer for this alarm before setting a new one
    if (snoozeTimersRef.current.has(strId)) {
      clearTimeout(snoozeTimersRef.current.get(strId));
      snoozeTimersRef.current.delete(strId);
    }

    // Set snooze timestamp in map
    snoozedAlarmsRef.current.set(strId, snoozeUntil);
    // Keep trigger lock armed during the snooze window
    triggeredAlarmIdsRef.current.add(strId);

    // Schedule 5-minute timer
    const timerId = setTimeout(() => {
      console.log(`[GeoAlarm Snooze] 5-minute snooze timer expired for alarm ${strId}. Releasing snooze and re-evaluating...`);
      snoozeTimersRef.current.delete(strId);
      snoozedAlarmsRef.current.delete(strId);
      triggeredAlarmIdsRef.current.delete(strId);

      // Requirement 6: Immediately re-evaluate latest known GPS position if tracking is active
      if (isTrackingRef.current && currentLocationRef.current && processLocationUpdateRef.current) {
        const { latitude, longitude, accuracy } = currentLocationRef.current;
        console.log(
          `[GeoAlarm Snooze] Immediately re-evaluating latest GPS position (${latitude}, ${longitude}) following snooze expiry...`
        );
        processLocationUpdateRef.current(latitude, longitude, accuracy, false);
      } else {
        console.log('[GeoAlarm Snooze] Snooze expired but tracking is currently inactive or no location known.');
      }
    }, snoozeDuration);

    snoozeTimersRef.current.set(strId, timerId);
  }, []);

  /**
   * Generic coordinate simulator (for testing).
   */
  const simulateLocation = (lat, lon, accuracy = 5) => {
    simulationLockUntilRef.current = Date.now() + 6000;
    processLocationUpdate(lat, lon, accuracy, true);
  };

  // Cleanup watchPosition, recovery timers, active notification, and all snooze timers on unmount (Requirement 3 & 8)
  useEffect(() => {
    return () => {
      if (watchRecoveryTimerRef.current) {
        clearTimeout(watchRecoveryTimerRef.current);
        watchRecoveryTimerRef.current = null;
      }
      if (transientEmptyTimerRef.current) {
        clearTimeout(transientEmptyTimerRef.current);
        transientEmptyTimerRef.current = null;
      }
      if (watchIdRef.current !== null) {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }
      stopAlarmSound();
      if (activeNotificationRef.current) {
        try {
          activeNotificationRef.current.close();
        } catch (e) {}
        activeNotificationRef.current = null;
      }
      // Clear all active snooze timers on unmount
      for (const timerId of snoozeTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      snoozeTimersRef.current.clear();
      snoozedAlarmsRef.current.clear();
    };
  }, []);

  const value = {
    isTracking,
    currentLocation,
    activeAlarms,
    setActiveAlarms,
    nearestAlarm,
    trackingError,
    notificationPermission,
    triggeredAlarm,
    startTracking,
    stopTracking,
    dismissAlarm,
    snoozeAlarm,
    clearAlarmSnooze,
    simulateLocation,
    simulateAlarmArrival,
    syncAlarms,
    resetAlarmTriggerLock,
    requestNotificationPermission,
  };

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
};
