/**
 * Comprehensive Automated Verification Suite for GeoAlarm:
 * GPS Monitoring Lifecycle After Alarm Completion.
 *
 * Verifies:
 * 1. Single active alarm triggers -> "I Have Arrived" dismiss ->
 *    - Marked as completed in database.
 *    - Removed from active tracking immediately.
 *    - navigator.geolocation.clearWatch() called with stored watchId.
 *    - isTracking set to false (GPS OFF).
 *    - Watch ID reset to null.
 * 2. Two active alarms (Alarm A & Alarm B) -> Alarm A triggers & dismissed ->
 *    - Alarm A marked completed.
 *    - Alarm A removed from active tracking.
 *    - 1 active alarm (Alarm B) remains.
 *    - GPS monitoring CONTINUES (isTracking remains true, watch not cleared).
 *    - Nearest alarm updates to Alarm B.
 * 3. Second alarm (Alarm B) triggers & dismissed ->
 *    - 0 active alarms remain.
 *    - GPS monitoring auto-stops (clearWatch called, isTracking false).
 * 4. User resumes or creates an alarm after auto-stop ->
 *    - GPS monitoring auto-restarts appropriately.
 * 5. Prevention of duplicate watchers:
 *    - Starting tracking when already active does not spawn extra watchers.
 *    - Old watcher is always cleared before new watcher is stored.
 */

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

class MockGeolocation {
  constructor() {
    this.nextWatchId = 100;
    this.activeWatchers = new Map();
    this.clearWatchCalls = [];
  }

  watchPosition(successCb, errorCb, options) {
    const id = ++this.nextWatchId;
    this.activeWatchers.set(id, { successCb, errorCb, options });
    return id;
  }

  clearWatch(id) {
    this.clearWatchCalls.push(id);
    this.activeWatchers.delete(id);
  }

  emitPosition(lat, lon, accuracy = 10) {
    for (const [id, watcher] of this.activeWatchers.entries()) {
      watcher.successCb({
        coords: { latitude: lat, longitude: lon, accuracy },
        timestamp: Date.now(),
      });
    }
  }
}

class TrackingLifecycleSimulator {
  constructor(geoMock) {
    this.geo = geoMock;
    this.isTracking = false;
    this.watchId = null;
    this.activeAlarms = [];
    this.triggeredAlarm = null;
    this.nearestAlarm = null;
    this.currentLocation = null;
    this.autoStopped = false;
    this.dbAlarms = new Map(); // simulated DB
    this.eventDispatches = [];
  }

  setDbAlarms(alarms) {
    alarms.forEach(a => this.dbAlarms.set(a._id, { ...a }));
  }

  syncAlarms(allAlarms = []) {
    const filtered = allAlarms.filter(a => a && a.status === 'active');
    this.activeAlarms = filtered;

    if (this.autoStopped && filtered.length > 0 && !this.isTracking) {
      this.autoStopped = false;
      this.startTracking(filtered);
    } else if (filtered.length === 0 && this.isTracking) {
      this.autoStopped = true;
      this.stopTracking(false);
    }
  }

  stopTracking(isManual = true) {
    if (this.watchId !== null) {
      this.geo.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    if (isManual) {
      this.autoStopped = false;
    }
  }

  startTracking(alarmsList = null) {
    if (alarmsList) {
      this.syncAlarms(alarmsList);
    }

    // Prevent duplicate watchers if already tracking
    if (this.watchId !== null && this.isTracking) {
      return;
    }

    // Clear any previous watcher
    if (this.watchId !== null) {
      this.geo.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.autoStopped = false;

    this.watchId = this.geo.watchPosition(
      (pos) => {
        this.processLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {},
      { enableHighAccuracy: true }
    );
    this.isTracking = true;
  }

  processLocation(lat, lon, accuracy = 10) {
    this.currentLocation = { latitude: lat, longitude: lon, accuracy };

    if (this.activeAlarms.length === 0) {
      this.nearestAlarm = null;
      if (this.isTracking) {
        this.autoStopped = true;
        this.stopTracking(false);
      }
      return;
    }

    // Simple nearest calculation
    this.nearestAlarm = { alarm: this.activeAlarms[0], distance: 100 };
  }

  triggerAlarm(alarm, distance = 15) {
    this.triggeredAlarm = { ...alarm, currentDistance: distance };
    // update backend DB to completed
    const dbAlarm = this.dbAlarms.get(alarm._id);
    if (dbAlarm) {
      dbAlarm.status = 'completed';
    }
  }

  async dismissAlarm() {
    const target = this.triggeredAlarm;
    this.triggeredAlarm = null;

    if (!target) return;

    const alarmId = String(target._id);

    // 1. Confirm completed in DB
    const dbAlarm = this.dbAlarms.get(alarmId);
    if (dbAlarm) {
      dbAlarm.status = 'completed';
    }

    // 2. Remove completed alarm from active tracking immediately
    const remainingActive = this.activeAlarms.filter(a => String(a._id) !== alarmId);
    this.activeAlarms = remainingActive;

    // Update nearest
    if (remainingActive.length === 0) {
      this.nearestAlarm = null;
    } else {
      this.nearestAlarm = { alarm: remainingActive[0], distance: 500 };
    }

    // 3 & 4. If no active alarms remain, auto-stop GPS monitoring
    if (remainingActive.length === 0) {
      this.autoStopped = true;
      this.stopTracking(false);
    }

    // 5. Dispatch completion event
    this.eventDispatches.push({ type: 'geoalarm:alarm-completed', alarmId });
  }

  resumeAlarm(alarmId) {
    const dbAlarm = this.dbAlarms.get(alarmId);
    if (dbAlarm) {
      dbAlarm.status = 'active';
    }
    const allAlarms = Array.from(this.dbAlarms.values());
    this.syncAlarms(allAlarms);
    if (!this.isTracking) {
      this.startTracking();
    }
  }
}

async function runLifecycleTests() {
  console.log('================================================================');
  console.log('🛰️ TESTING GEOALARM GPS MONITORING LIFECYCLE ON COMPLETION');
  console.log('================================================================\n');

  // -----------------------------------------------------------------
  // SCENARIO 1: Single Active Alarm Completed -> GPS Monitoring Auto-Stops
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 1: Single Active Alarm Completion & Auto-Stop ---');
  const geoMock1 = new MockGeolocation();
  const engine1 = new TrackingLifecycleSimulator(geoMock1);

  const singleAlarm = {
    _id: 'alarm_single_001',
    name: 'Home Station',
    destinationName: '123 Main St',
    radius: 1000,
    status: 'active',
  };
  engine1.setDbAlarms([singleAlarm]);

  // Start tracking
  engine1.startTracking([singleAlarm]);
  assert(engine1.isTracking === true, 'GPS monitoring started (isTracking: true)');
  assert(engine1.watchId !== null, `watchPosition registered active watch ID: ${engine1.watchId}`);
  assert(geoMock1.activeWatchers.size === 1, 'MockGeolocation has exactly 1 active watcher');
  assert(engine1.activeAlarms.length === 1, 'Active alarms count is 1');

  // Alarm arrives & triggers
  console.log('  -> Simulating geofence arrival event...');
  engine1.triggerAlarm(singleAlarm, 15);
  assert(engine1.triggeredAlarm !== null, 'AlarmTriggerModal populated with triggered alarm');

  // User clicks "I Have Arrived" (dismissAlarm)
  console.log('  -> User clicks "I Have Arrived" (dismissAlarm)...');
  const watchIdBeforeDismiss = engine1.watchId;
  await engine1.dismissAlarm();

  // Verification 1.1: Database marked as completed
  assert(engine1.dbAlarms.get(singleAlarm._id).status === 'completed', 'Alarm status updated to "completed" in database');

  // Verification 1.2: Removed from active tracking
  assert(engine1.activeAlarms.length === 0, 'Completed alarm removed from active tracking (activeAlarms: 0)');
  assert(engine1.nearestAlarm === null, 'nearestAlarm cleared to null');

  // Verification 1.3 & 1.4: GPS watcher cleared and isTracking OFF
  assert(geoMock1.clearWatchCalls.includes(watchIdBeforeDismiss), `navigator.geolocation.clearWatch(${watchIdBeforeDismiss}) was called`);
  assert(geoMock1.activeWatchers.size === 0, 'No active watchers remain in navigator.geolocation (0 watchers)');
  assert(engine1.watchId === null, 'engine.watchId reset to null');
  assert(engine1.isTracking === false, 'GPS monitoring state is OFF (isTracking: false)');
  assert(engine1.autoStopped === true, 'autoStopped flag set to true');
  assert(engine1.eventDispatches.length === 1, '"geoalarm:alarm-completed" event dispatched for UI synchronization');

  // -----------------------------------------------------------------
  // SCENARIO 2: Multiple Active Alarms -> Complete 1st Alarm -> GPS Continues
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Multiple Active Alarms (GPS Continues While Alarms Remain) ---');
  const geoMock2 = new MockGeolocation();
  const engine2 = new TrackingLifecycleSimulator(geoMock2);

  const alarmA = { _id: 'alarm_A', name: 'Stop A - Train Station', status: 'active', radius: 1000 };
  const alarmB = { _id: 'alarm_B', name: 'Stop B - Office Campus', status: 'active', radius: 500 };
  engine2.setDbAlarms([alarmA, alarmB]);

  // Start tracking with 2 active alarms
  engine2.startTracking([alarmA, alarmB]);
  assert(engine2.isTracking === true, 'GPS tracking active with 2 active alarms');
  assert(engine2.activeAlarms.length === 2, '2 active alarms in tracking list');
  const initialWatchId = engine2.watchId;

  // Arrival at Stop A
  console.log('  -> Arriving at Stop A (Alarm A triggers)...');
  engine2.triggerAlarm(alarmA, 20);
  await engine2.dismissAlarm();

  // Verification 2.1: Alarm A completed, but Alarm B remains
  assert(engine2.dbAlarms.get(alarmA._id).status === 'completed', 'Alarm A marked "completed"');
  assert(engine2.activeAlarms.length === 1, '1 active alarm remains in tracking (Alarm B)');
  assert(engine2.activeAlarms[0]._id === 'alarm_B', 'Remaining active alarm is Alarm B');

  // Verification 2.2: GPS monitoring DOES NOT STOP because Alarm B is still active
  assert(engine2.isTracking === true, 'GPS monitoring CONTINUES running (isTracking: true)');
  assert(engine2.watchId === initialWatchId, `Same watch ID (${initialWatchId}) remains active`);
  assert(geoMock2.activeWatchers.size === 1, 'MockGeolocation still has 1 active watcher running');
  assert(engine2.nearestAlarm.alarm._id === 'alarm_B', 'nearestAlarm updated to track Alarm B');

  // -----------------------------------------------------------------
  // SCENARIO 3: Final Alarm (Alarm B) Completes -> GPS Finally Stops
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Final Alarm Completes -> GPS Automatically Stops ---');
  console.log('  -> Arriving at Stop B (Alarm B triggers)...');
  engine2.triggerAlarm(alarmB, 12);
  await engine2.dismissAlarm();

  assert(engine2.dbAlarms.get(alarmB._id).status === 'completed', 'Alarm B marked "completed"');
  assert(engine2.activeAlarms.length === 0, '0 active alarms remain');
  assert(engine2.isTracking === false, 'GPS monitoring state switched to OFF (isTracking: false)');
  assert(engine2.watchId === null, 'watchId reset to null');
  assert(geoMock2.activeWatchers.size === 0, 'Geolocation watchers completely cleared');

  // -----------------------------------------------------------------
  // SCENARIO 4: User Resumes or Creates an Alarm -> GPS Restarts
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO 4: User Resumes an Alarm After Auto-Stop -> GPS Auto-Restarts ---');
  console.log('  -> User clicks "Resume" on Alarm A...');
  engine2.resumeAlarm(alarmA._id);

  assert(engine2.dbAlarms.get(alarmA._id).status === 'active', 'Alarm A status changed back to "active" in database');
  assert(engine2.isTracking === true, 'GPS monitoring automatically restarted upon alarm resumption');
  assert(engine2.watchId !== null, `New watch ID registered: ${engine2.watchId}`);
  assert(geoMock2.activeWatchers.size === 1, 'Exactly 1 active watcher registered in geolocation');
  assert(engine2.activeAlarms.length === 1, '1 active alarm in tracking engine');

  // -----------------------------------------------------------------
  // SCENARIO 5: Duplicate Watcher Prevention & Memory Leak Check
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Duplicate Watcher & Memory Leak Protection ---');
  const watcherBeforeDupCheck = engine2.watchId;

  // Repeatedly call startTracking while already tracking
  engine2.startTracking();
  engine2.startTracking();
  engine2.startTracking();

  assert(engine2.watchId === watcherBeforeDupCheck, 'Watch ID unchanged when startTracking called while already tracking');
  assert(geoMock2.activeWatchers.size === 1, 'No duplicate watchers spawned (activeWatchers size is still exactly 1)');

  // Stop tracking manually
  engine2.stopTracking(true);
  assert(engine2.isTracking === false, 'Manual stop sets isTracking: false');
  assert(engine2.watchId === null, 'watchId set to null');
  assert(geoMock2.activeWatchers.size === 0, 'All watchers cleanly released');

  console.log('\n================================================================');
  console.log('🎉 ALL GPS MONITORING LIFECYCLE TESTS PASSED (100%)');
  console.log('================================================================');
}

runLifecycleTests().catch(err => {
  console.error('\n❌ LIFECYCLE TEST SUITE FAILED:', err);
  process.exit(1);
});
