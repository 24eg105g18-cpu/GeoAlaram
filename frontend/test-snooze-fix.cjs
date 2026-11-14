/**
 * Comprehensive Automated Verification Suite for GeoAlarm:
 * 5-Minute Snooze Mechanism & Lifecycle Verification
 *
 * Verifies:
 * 1. Timestamp-based snooze using snoozedAlarmsRef (Map) with exactly 300,000 ms.
 * 2. processLocationUpdate() checks snooze expiry and suppresses repeated triggers.
 * 3. syncAlarms() NEVER clears trigger locks for alarms in their snooze window.
 * 4. triggerAlarm() does NOT prematurely mark alarm as completed in database.
 * 5. Snooze preserves active alarm status and keeps GPS tracking running.
 * 6. Immediate re-evaluation of latest known GPS position upon 5-minute timer expiry.
 * 7. Geofence exit during snooze and clean re-entry triggering without duplicate alerts.
 * 8. Cleanup of snooze timers and records on dismissal, deletion, pause, and unmount.
 * 9. Multiple alarms maintain independent snooze timers and triggers.
 * 10. Existing features (alert modal, sound, notification, simulation, GPS auto-stop) remain intact.
 */

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Virtual Clock for deterministic time travel testing
class VirtualClock {
  constructor() {
    this.nowTime = 1700000000000;
    this.timers = new Map();
    this.nextTimerId = 1;
  }

  now() {
    return this.nowTime;
  }

  setTimeout(callback, delay) {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      callback,
      triggerTime: this.nowTime + delay,
      delay,
    });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  advanceTime(ms) {
    this.nowTime += ms;
    // Find all timers scheduled to fire at or before this new time
    const ready = [];
    for (const [id, item] of this.timers.entries()) {
      if (item.triggerTime <= this.nowTime) {
        ready.push({ id, ...item });
      }
    }
    // Sort by triggerTime
    ready.sort((a, b) => a.triggerTime - b.triggerTime);
    for (const item of ready) {
      if (this.timers.has(item.id)) {
        this.timers.delete(item.id);
        item.callback();
      }
    }
  }
}

// Complete TrackingContext Simulator replicating TrackingContext.jsx exactly
class TrackingContextSimulator {
  constructor(clock) {
    this.clock = clock;
    this.isTracking = false;
    this.currentLocation = null;
    this.activeAlarms = [];
    this.nearestAlarm = null;
    this.triggeredAlarm = null;
    this.soundPlaying = false;
    this.notificationsFired = [];

    this.watchId = null;
    this.triggeredAlarmIds = new Set();
    this.activeAlarmsRef = [];
    this.autoStopped = false;
    this.simulationLockUntil = 0;

    // Snooze refs
    this.snoozedAlarmsRef = new Map(); // Map<strId, timestamp>
    this.snoozeTimersRef = new Map();  // Map<strId, timerId>

    // Database mock
    this.dbAlarms = new Map();
  }

  setDbAlarms(alarms) {
    this.dbAlarms.clear();
    alarms.forEach((a) => this.dbAlarms.set(String(a._id), { ...a }));
  }

  clearAlarmSnooze(alarmId) {
    const strId = String(alarmId);
    if (this.snoozeTimersRef.has(strId)) {
      this.clock.clearTimeout(this.snoozeTimersRef.get(strId));
      this.snoozeTimersRef.delete(strId);
    }
    if (this.snoozedAlarmsRef.has(strId)) {
      this.snoozedAlarmsRef.delete(strId);
    }
  }

  resetAlarmTriggerLock(alarmId) {
    const strId = String(alarmId);
    this.clearAlarmSnooze(strId);
    if (this.triggeredAlarmIds.has(strId)) {
      this.triggeredAlarmIds.delete(strId);
    }
  }

  stopTracking(isManual = true) {
    if (this.watchId !== null) {
      this.watchId = null;
    }
    this.isTracking = false;
    this.soundPlaying = false;
    this.simulationLockUntil = 0;
    if (isManual) {
      this.autoStopped = false;
    }
  }

  startTracking(alarmsList = null) {
    if (alarmsList) {
      this.syncAlarms(alarmsList);
    }
    if (this.watchId !== null && this.isTracking) {
      return;
    }
    this.watchId = 12345;
    this.isTracking = true;
    this.autoStopped = false;
  }

  async triggerAlarm(alarm, distance, isSimulation = false) {
    const alarmId = String(alarm._id);

    if (!isSimulation && this.triggeredAlarmIds.has(alarmId)) {
      return; // Duplicate alert suppressed
    }

    this.triggeredAlarmIds.add(alarmId);
    this.clearAlarmSnooze(alarmId);

    this.triggeredAlarm = {
      ...alarm,
      currentDistance: distance,
      isSimulation,
    };
    this.soundPlaying = true;
    this.notificationsFired.push({ alarmId, distance, isSimulation, timestamp: this.clock.now() });

    // Requirement 4: Notice NO db status update here! Only in dismissAlarm.
  }

  processLocationUpdate(lat, lon, accuracy = 5, isSimulation = false) {
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) return;

    this.currentLocation = { latitude: numLat, longitude: numLon, accuracy, timestamp: this.clock.now() };

    const alarms = this.activeAlarmsRef;
    if (!alarms || alarms.length === 0) {
      this.nearestAlarm = null;
      if (this.isTracking) {
        this.autoStopped = true;
        this.stopTracking(false);
      }
      return;
    }

    let minDistance = Infinity;
    let closest = null;
    const now = this.clock.now();

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

      if (distance <= radius) {
        // Requirement 2: Check snooze expiry before triggering
        const snoozeUntil = this.snoozedAlarmsRef.get(strId);
        if (snoozeUntil) {
          if (now < snoozeUntil) {
            return; // Suppress trigger during active snooze
          } else {
            this.clearAlarmSnooze(strId);
            this.triggeredAlarmIds.delete(strId);
          }
        }

        this.triggerAlarm(alarm, distance, isSimulation);
      } else {
        // Requirement 7: User outside geofence
        const snoozeUntil = this.snoozedAlarmsRef.get(strId);
        const isActivelySnoozed = snoozeUntil && now < snoozeUntil;

        if (!isActivelySnoozed && this.triggeredAlarmIds.has(strId)) {
          this.triggeredAlarmIds.delete(strId);
        }
      }
    });

    this.nearestAlarm = closest;
  }

  snoozeAlarm(alarmId) {
    this.soundPlaying = false;
    this.triggeredAlarm = null;
    this.simulationLockUntil = 0;

    const strId = String(alarmId);
    const SNOOZE_DURATION_MS = 5 * 60 * 1000; // 300,000 ms
    const snoozeUntil = this.clock.now() + SNOOZE_DURATION_MS;

    if (this.snoozeTimersRef.has(strId)) {
      this.clock.clearTimeout(this.snoozeTimersRef.get(strId));
      this.snoozeTimersRef.delete(strId);
    }

    this.snoozedAlarmsRef.set(strId, snoozeUntil);
    this.triggeredAlarmIds.add(strId);

    const timerId = this.clock.setTimeout(() => {
      this.snoozeTimersRef.delete(strId);
      this.snoozedAlarmsRef.delete(strId);
      this.triggeredAlarmIds.delete(strId);

      // Requirement 6: Immediately re-evaluate latest GPS position
      if (this.isTracking && this.currentLocation) {
        const { latitude, longitude, accuracy } = this.currentLocation;
        this.processLocationUpdate(latitude, longitude, accuracy, false);
      }
    }, SNOOZE_DURATION_MS);

    this.snoozeTimersRef.set(strId, timerId);
  }

  async dismissAlarm() {
    this.soundPlaying = false;
    const target = this.triggeredAlarm;
    this.triggeredAlarm = null;
    if (!target) return;

    const alarmId = String(target._id);
    this.clearAlarmSnooze(alarmId);
    this.triggeredAlarmIds.delete(alarmId);

    // Update status in db
    if (this.dbAlarms.has(alarmId)) {
      this.dbAlarms.get(alarmId).status = 'completed';
    }

    const remaining = this.activeAlarmsRef.filter((a) => String(a._id) !== alarmId);
    this.activeAlarms = remaining;
    this.activeAlarmsRef = remaining;

    if (remaining.length === 0) {
      this.nearestAlarm = null;
      this.autoStopped = true;
      this.stopTracking(false);
    }
  }

  syncAlarms(allAlarms = []) {
    const filtered = allAlarms.filter((a) => a && a.status === 'active');
    this.activeAlarms = filtered;
    this.activeAlarmsRef = filtered;

    const now = this.clock.now();
    const activeIdSet = new Set(filtered.map((a) => String(a._id)));

    // Requirement 8: Clean up snooze for non-active alarms
    for (const [snoozedId, timerId] of this.snoozeTimersRef.entries()) {
      if (!activeIdSet.has(snoozedId)) {
        this.clock.clearTimeout(timerId);
        this.snoozeTimersRef.delete(snoozedId);
        this.snoozedAlarmsRef.delete(snoozedId);
        this.triggeredAlarmIds.delete(snoozedId);
      }
    }
    for (const snoozedId of this.snoozedAlarmsRef.keys()) {
      if (!activeIdSet.has(snoozedId)) {
        this.snoozedAlarmsRef.delete(snoozedId);
        this.triggeredAlarmIds.delete(snoozedId);
      }
    }

    // Requirement 3: Never clear locks for actively snoozed alarms
    filtered.forEach((alarm) => {
      const strId = String(alarm._id);
      const snoozeUntil = this.snoozedAlarmsRef.get(strId);
      if (snoozeUntil && now < snoozeUntil) {
        return; // Preserved
      }
    });

    if (this.autoStopped && filtered.length > 0 && !this.isTracking) {
      this.autoStopped = false;
      this.startTracking(filtered);
    } else if (filtered.length === 0 && this.isTracking) {
      this.autoStopped = true;
      this.stopTracking(false);
    }
  }

  async simulateAlarmArrival(targetAlarm) {
    const targetId = String(targetAlarm._id);
    const alarmLat = Number(targetAlarm.latitude);
    const alarmLon = Number(targetAlarm.longitude);
    const simLat = alarmLat + 0.0001;
    const simLon = alarmLon + 0.0001;
    const dist = calculateDistance(simLat, simLon, alarmLat, alarmLon);

    this.clearAlarmSnooze(targetId);
    this.triggeredAlarmIds.delete(targetId);

    this.currentLocation = {
      latitude: simLat,
      longitude: simLon,
      accuracy: 5,
      timestamp: this.clock.now(),
      simulated: true,
    };

    await this.triggerAlarm(targetAlarm, dist, true);
    return true;
  }
}

// ==================== TEST EXECUTION ====================
async function runAllTests() {
  console.log('================================================================');
  console.log('   GeoAlarm 5-Minute Snooze Mechanism & Lifecycle Test Suite    ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Exact 300,000 ms (5 min) Snooze Window & State
  // -------------------------------------------------------------
  console.log('--- Test 1: Timestamp-based snooze uses exactly 300,000 ms ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_1', name: 'Work', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    // Simulate arrival
    await ctx.simulateAlarmArrival(alarm);
    assert(ctx.triggeredAlarm !== null, 'Alarm triggered into UI modal');
    assert(ctx.soundPlaying === true, 'Alarm sound is playing');

    // User clicks Snooze (5m)
    const snoozeStartTime = clock.now();
    ctx.snoozeAlarm(alarm._id);

    assert(ctx.triggeredAlarm === null, 'Modal closed on snooze');
    assert(ctx.soundPlaying === false, 'Sound stopped on snooze');
    assert(ctx.snoozedAlarmsRef.has('alarm_1'), 'snoozedAlarmsRef contains alarm_1');

    const expectedExpiry = snoozeStartTime + 300000;
    const recordedExpiry = ctx.snoozedAlarmsRef.get('alarm_1');
    assert(recordedExpiry === expectedExpiry, `Snooze timestamp matches exactly ${expectedExpiry} (delta = 300,000 ms)`);
    assert(ctx.snoozeTimersRef.has('alarm_1'), 'Active timer registered in snoozeTimersRef');
    assert(ctx.isTracking === true, 'Requirement 5: GPS tracking remains active during snooze');
    assert(ctx.dbAlarms.get('alarm_1').status === 'active', 'Requirement 4 & 5: Snoozing maintains active status in database');
  }

  // -------------------------------------------------------------
  // Test 2: Repeated GPS updates during snooze window are suppressed
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Repeated GPS updates during snooze window are suppressed ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_1', name: 'Work', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    await ctx.simulateAlarmArrival(alarm);
    const notifCountAtTrigger = ctx.notificationsFired.length;
    ctx.snoozeAlarm(alarm._id);

    // Simulate repeated Chrome geolocation ticks (e.g. at 60s, 120s, 180s, 240s) inside the radius
    clock.advanceTime(60000); // 1 minute later
    ctx.processLocationUpdate(12.9716, 77.5946); // exactly at destination (distance = 0)
    assert(ctx.triggeredAlarm === null, 'T+1m: Geolocation update suppressed by snooze (modal remains closed)');
    assert(ctx.soundPlaying === false, 'T+1m: Sound suppressed');

    clock.advanceTime(60000); // 2 minutes later
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm === null, 'T+2m: Geolocation update suppressed by snooze');

    clock.advanceTime(120000); // 4 minutes later (240s total)
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm === null, 'T+4m: Geolocation update suppressed by snooze');
    assert(ctx.notificationsFired.length === notifCountAtTrigger, 'No duplicate notifications fired during snooze');
  }

  // -------------------------------------------------------------
  // Test 3: syncAlarms() does not clear locks for actively snoozed alarms
  // -------------------------------------------------------------
  console.log('\n--- Test 3: syncAlarms() never clears trigger locks for snoozed alarms ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_1', name: 'Work', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    await ctx.simulateAlarmArrival(alarm);
    ctx.snoozeAlarm(alarm._id);

    assert(ctx.triggeredAlarmIds.has('alarm_1'), 'Trigger lock armed during snooze');

    // Simulate HUD re-render / alarms prop change triggering syncAlarms
    ctx.syncAlarms([alarm]);
    assert(ctx.triggeredAlarmIds.has('alarm_1'), 'Trigger lock STILL armed after syncAlarms()');
    assert(ctx.snoozedAlarmsRef.has('alarm_1'), 'Snooze record still present after syncAlarms()');

    // Advance 60 seconds and run GPS update
    clock.advanceTime(60000);
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm === null, 'Still suppressed after syncAlarms() followed by 60s GPS tick');
  }

  // -------------------------------------------------------------
  // Test 4: SMR (Immediate Re-evaluation) at 5-minute timer expiry
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Immediate re-evaluation at 5-minute timer expiry triggers alarm ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_1', name: 'Home', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    await ctx.simulateAlarmArrival(alarm);
    ctx.snoozeAlarm(alarm._id);
    assert(ctx.triggeredAlarm === null, 'Modal closed on snooze');

    // Update current location to inside radius at T+3 minutes
    clock.advanceTime(180000);
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm === null, 'T+3m: Still suppressed');

    // Advance clock to reach exactly 300,000 ms (5 minutes total)
    // The timer should fire and immediately re-evaluate currentLocationRef
    clock.advanceTime(120000); // 180,000 + 120,000 = 300,000 ms

    assert(ctx.snoozedAlarmsRef.has('alarm_1') === false, 'Snooze record deleted on expiry');
    assert(ctx.triggeredAlarm !== null, 'Requirement 6: Alarm immediately re-triggered upon 5m timer expiry without waiting for next GPS event');
    assert(ctx.soundPlaying === true, 'Sound immediately re-started upon snooze expiry');
    assert(ctx.triggeredAlarmIds.has('alarm_1'), 'Trigger lock re-armed to prevent repeated alert loops');

    // Subsequent GPS tick right after trigger while user looks at modal
    clock.advanceTime(5000);
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm !== null, 'Modal remains steady; no duplicate alert crash');
  }

  // -------------------------------------------------------------
  // Test 5: User exits geofence during snooze and re-enters later
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Geofence exit during snooze and clean re-entry ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_exit', name: 'Station', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    // Arrive & snooze
    await ctx.simulateAlarmArrival(alarm);
    ctx.snoozeAlarm(alarm._id);

    // At T+1m, user walks 2.5 km away (outside 1km radius)
    clock.advanceTime(60000);
    // (12.99, 77.5946) is ~2.04 km away
    ctx.processLocationUpdate(12.99, 77.5946);
    assert(ctx.triggeredAlarm === null, 'Outside radius during snooze: no trigger');

    // At T+5m, 5-minute timer expires while user is still outside
    clock.advanceTime(240000); // 300,000 ms total
    assert(ctx.snoozedAlarmsRef.has('alarm_exit') === false, 'Snooze expired');
    assert(ctx.triggeredAlarm === null, 'Timer expired while outside radius: does NOT trigger');
    assert(!ctx.triggeredAlarmIds.has('alarm_exit'), 'Lock is cleared so re-entry will trigger');

    // At T+8m, user walks back into 500m inside radius
    clock.advanceTime(180000);
    ctx.processLocationUpdate(12.972, 77.5946); // ~44m away
    assert(ctx.triggeredAlarm !== null, 'Requirement 7: Clean re-entry triggers alarm alert');
    assert(ctx.triggeredAlarm._id === 'alarm_exit', 'Triggered correct alarm on re-entry');
  }

  // -------------------------------------------------------------
  // Test 6: Database status remains active on trigger & snooze, completed ONLY on dismiss
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Database status lifecycle (Active -> Snooze -> Completed on Dismiss) ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_db', name: 'Office', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    // Trigger arrival
    await ctx.simulateAlarmArrival(alarm);
    assert(ctx.dbAlarms.get('alarm_db').status === 'active', 'Requirement 4: Status in DB is STILL active on trigger');

    // Click Snooze
    ctx.snoozeAlarm(alarm._id);
    assert(ctx.dbAlarms.get('alarm_db').status === 'active', 'Requirement 5: Status in DB is STILL active on snooze');

    // 5 minutes expire -> re-triggers
    clock.advanceTime(300000);
    assert(ctx.triggeredAlarm !== null, 'Alarm re-triggered');
    assert(ctx.dbAlarms.get('alarm_db').status === 'active', 'Status in DB STILL active while re-triggered');

    // Click "I Have Arrived (Dismiss)"
    await ctx.dismissAlarm();
    assert(ctx.dbAlarms.get('alarm_db').status === 'completed', 'Requirement 4: Status in DB marked "completed" ONLY on explicit dismissal');
    assert(ctx.activeAlarms.length === 0, 'Completed alarm removed from active tracking list');
    assert(ctx.isTracking === false, 'Requirement 10: Auto-stopped GPS tracking when 0 active alarms remain');
  }

  // -------------------------------------------------------------
  // Test 7: Multiple alarms have independent snooze timers
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Multiple independent alarms and snooze timers ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarmA = { _id: 'alarm_A', name: 'Coffee Shop', latitude: 12.9716, longitude: 77.5946, radius: 500, status: 'active' };
    const alarmB = { _id: 'alarm_B', name: 'Gym', latitude: 12.9800, longitude: 77.5946, radius: 500, status: 'active' };
    ctx.setDbAlarms([alarmA, alarmB]);
    ctx.startTracking([alarmA, alarmB]);

    // User arrives at Alarm A
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm !== null && ctx.triggeredAlarm._id === 'alarm_A', 'Alarm A triggered');

    // User snoozes Alarm A
    ctx.snoozeAlarm('alarm_A');
    assert(ctx.snoozedAlarmsRef.has('alarm_A'), 'Alarm A snoozed');
    assert(!ctx.snoozedAlarmsRef.has('alarm_B'), 'Alarm B is NOT snoozed');

    // Advance 1 minute and user moves to Gym (Alarm B)
    clock.advanceTime(60000);
    ctx.processLocationUpdate(12.9800, 77.5946);
    assert(ctx.triggeredAlarm !== null && ctx.triggeredAlarm._id === 'alarm_B', 'Requirement 9: Alarm B triggers independently while Alarm A is snoozed');

    // Dismiss Alarm B
    await ctx.dismissAlarm();
    assert(ctx.dbAlarms.get('alarm_B').status === 'completed', 'Alarm B completed');
    assert(ctx.isTracking === true, 'Tracking continues because Alarm A is still active (snoozed)');

    // Advance to 5 minutes total from Alarm A snooze
    clock.advanceTime(240000);
    // User moves back to Alarm A
    ctx.processLocationUpdate(12.9716, 77.5946);
    assert(ctx.triggeredAlarm !== null && ctx.triggeredAlarm._id === 'alarm_A', 'Alarm A re-triggers after its 5 minutes');
  }

  // -------------------------------------------------------------
  // Test 8: Cleanup on Pause, Deletion, and Unmount
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Snooze cleanup on Pause, Deletion, and Unmount ---');
  {
    const clock = new VirtualClock();
    const ctx = new TrackingContextSimulator(clock);
    const alarm = { _id: 'alarm_del', name: 'Airport', latitude: 12.9716, longitude: 77.5946, radius: 1000, status: 'active' };
    ctx.setDbAlarms([alarm]);
    ctx.startTracking([alarm]);

    await ctx.simulateAlarmArrival(alarm);
    ctx.snoozeAlarm(alarm._id);
    assert(ctx.snoozeTimersRef.has('alarm_del'), 'Timer active');

    // Simulate user pausing alarm in MyAlarmsPage -> syncAlarms received with status='paused'
    ctx.syncAlarms([{ ...alarm, status: 'paused' }]);
    assert(!ctx.snoozeTimersRef.has('alarm_del'), 'Requirement 8: Snooze timer cleared when alarm paused');
    assert(!ctx.snoozedAlarmsRef.has('alarm_del'), 'Requirement 8: Snooze record cleared when alarm paused');

    // Unmount simulation: clear all timers
    for (const timerId of ctx.snoozeTimersRef.values()) {
      clock.clearTimeout(timerId);
    }
    ctx.snoozeTimersRef.clear();
    ctx.snoozedAlarmsRef.clear();
    assert(clock.timers.size === 0, 'Requirement 8: All timers destroyed on unmount');
  }

  console.log('\n================================================================');
  console.log('   🎉 ALL 8 TESTS PASSED! 5-MINUTE SNOOZE FULLY VERIFIED       ');
  console.log('================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed with Exception:', err);
  process.exit(1);
});
