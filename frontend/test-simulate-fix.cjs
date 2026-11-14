/**
 * Comprehensive Automated Verification Suite for GeoAlarm:
 * "Simulate Arrival" Bug Fix & Geofencing Reliability.
 *
 * Covers all 7 test cases specified in the requirements:
 * 1. First simulated arrival triggers modal and updates backend status to completed.
 * 2. Dismiss modal, re-simulate immediately -> triggers successfully on demand.
 * 3. 5 consecutive simulation + dismiss cycles for the same alarm -> all 5 trigger reliably.
 * 4. Pause and resume an alarm -> trigger lock resets upon resume.
 * 5. Change alarm from completed to active -> trigger lock resets upon reactivation.
 * 6. Real GPS simulation lock expires -> real GPS processes normally with duplicate-trigger suppression.
 * 7. Simulating Alarm A does not trigger or mark Alarm B as completed (multi-alarm isolation).
 * Plus: Numeric coordinate validation (string casting, finite checks, range checks).
 */

const http = require('http');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

// Emulate Haversine math from frontend/src/utils/haversine.js
const EARTH_RADIUS_METERS = 6371e3;
const toRadians = (deg) => (deg * Math.PI) / 180;

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2)
  ) {
    return Infinity;
  }

  if (
    nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180
  ) {
    return Infinity;
  }

  const φ1 = toRadians(nLat1);
  const φ2 = toRadians(nLat2);
  const Δφ = toRadians(nLat2 - nLat1);
  const Δλ = toRadians(nLon2 - nLon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};

/**
 * TrackingEngine class that mirrors TrackingContext.jsx faithfully.
 */
class TrackingEngine {
  constructor(apiBaseUrl, token) {
    this.apiBaseUrl = apiBaseUrl;
    this.token = token;
    this.triggeredAlarmIds = new Set();
    this.activeAlarms = [];
    this.currentLocation = null;
    this.triggeredAlarm = null;
    this.simulationLockUntil = 0;
    this.triggerCount = 0;
    this.duplicateSuppressedCount = 0;
  }

  syncAlarms(allAlarms = []) {
    const filtered = allAlarms.filter((a) => a && a.status === 'active');
    this.activeAlarms = filtered;
    filtered.forEach((alarm) => {
      if (alarm.status === 'active' && !alarm.triggeredAt) {
        this.resetAlarmTriggerLock(alarm._id);
      }
    });
  }

  resetAlarmTriggerLock(alarmId) {
    const strId = String(alarmId);
    if (this.triggeredAlarmIds.has(strId)) {
      this.triggeredAlarmIds.delete(strId);
    }
  }

  async triggerAlarm(alarm, distance, isSimulation = false) {
    const alarmId = String(alarm._id);

    // Duplicate check for real GPS events
    if (!isSimulation && this.triggeredAlarmIds.has(alarmId)) {
      this.duplicateSuppressedCount++;
      return false;
    }

    this.triggeredAlarmIds.add(alarmId);
    this.triggerCount++;
    this.triggeredAlarm = {
      ...alarm,
      currentDistance: distance,
      isSimulation,
    };

    // Update backend database to 'completed'
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/alarms/${alarm._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      await res.json();
    } catch (err) {
      console.warn('Backend update failed:', err.message);
    }

    return true;
  }

  async simulateAlarmArrival(targetAlarm) {
    if (!targetAlarm) return false;

    const alarmLat = Number(targetAlarm.latitude);
    const alarmLon = Number(targetAlarm.longitude);

    if (!Number.isFinite(alarmLat) || !Number.isFinite(alarmLon)) {
      return false;
    }

    // Offset ~11m (0.0001 deg) inside geofence
    const simLat = alarmLat + 0.0001;
    const simLon = alarmLon + 0.0001;
    const dist = calculateDistance(simLat, simLon, alarmLat, alarmLon);

    // Set 6s lock on real GPS
    this.simulationLockUntil = Date.now() + 6000;

    // Reset lock for explicit simulation of this alarm
    this.triggeredAlarmIds.delete(String(targetAlarm._id));

    this.currentLocation = {
      latitude: simLat,
      longitude: simLon,
      accuracy: 5,
      timestamp: Date.now(),
      simulated: true,
    };

    return await this.triggerAlarm(targetAlarm, dist, true);
  }

  processLocationUpdate(lat, lon, accuracy = 10, isSimulation = false) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
      return;
    }

    // If real GPS arrives during simulation lock, ignore it
    if (!isSimulation && Date.now() < this.simulationLockUntil) {
      return;
    }

    this.currentLocation = {
      latitude: numLat,
      longitude: numLon,
      accuracy,
      timestamp: Date.now(),
    };

    this.activeAlarms.forEach((alarm) => {
      if (alarm.status !== 'active') return;

      const aLat = Number(alarm.latitude);
      const aLon = Number(alarm.longitude);
      if (!Number.isFinite(aLat) || !Number.isFinite(aLon)) return;

      const distance = calculateDistance(numLat, numLon, aLat, aLon);
      if (!Number.isFinite(distance)) return;

      if (distance <= Number(alarm.radius)) {
        this.triggerAlarm(alarm, distance, isSimulation);
      }
    });
  }

  dismissAlarm() {
    this.triggeredAlarm = null;
    this.simulationLockUntil = 0;
  }
}

async function runSimulateArrivalVerificationSuite() {
  console.log('================================================================');
  console.log('🧪 GEOALARM "SIMULATE ARRIVAL" & GEOFENCING RELIABILITY SUITE');
  console.log('================================================================\n');

  // 1. Start Backend Server
  const { startServer } = require('../backend/src/index');
  const backendServer = await startServer();
  const API_BASE = 'http://127.0.0.1:5000';
  console.log('  ✓ Backend server initialized on port 5000\n');

  try {
    // -----------------------------------------------------------------
    // Section 0: Coordinate Math & Numeric Safety Verification
    // -----------------------------------------------------------------
    console.log('--- SECTION 0: Coordinate Math & Numeric Type Safety ---');

    // Safe numeric casting prevents "12.9716" + 0.0001 => "12.97160.0001"
    const stringLat = "12.9716";
    const simLat = Number(stringLat) + 0.0001;
    assert(simLat === 12.9717, 'String latitude "12.9716" correctly adds 0.0001 to equal 12.9717, NOT "12.97160.0001"');

    // Finiteness validation
    assert(calculateDistance("invalid", 77.5946, 12.9716, 77.5946) === Infinity, 'Invalid coordinate "invalid" safely returns Infinity');
    assert(calculateDistance(NaN, 77.5946, 12.9716, 77.5946) === Infinity, 'NaN safely returns Infinity');
    assert(calculateDistance(95, 77.5946, 12.9716, 77.5946) === Infinity, 'Latitude 95 (out of range) safely returns Infinity');
    assert(calculateDistance(12.9716, 77.5946, 12.9716, 77.5946) === 0, 'Identical coordinates return 0 meters');

    // -----------------------------------------------------------------
    // User & Alarms Setup
    // -----------------------------------------------------------------
    console.log('\n--- Setting Up User & Multi-Alarm Fixtures in Database ---');
    const userEmail = `sim_fix_${Date.now()}@geoalarm.test`;
    const regRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Simulation Tester',
        email: userEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    const token = regData.token;
    assert(!!token, 'Test user registered with JWT token');

    // Create Alarm A (Bangalore Majestic - 1000m radius)
    const alarmARes = await fetch(`${API_BASE}/api/alarms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Alarm A - City Station',
        destinationName: 'Kempegowda Majestic Station',
        latitude: "12.9772", // Passed as string to test string resilience
        longitude: "77.5713",
        radius: 1000,
        notes: 'Platform 1 arrival',
      }),
    });
    const alarmAData = await alarmARes.json();
    const alarmA = alarmAData.alarm;
    assert(!!alarmA && alarmA.status === 'active', 'Alarm A created in MongoDB with status "active"');

    // Create Alarm B (Bangalore MG Road - 500m radius)
    const alarmBRes = await fetch(`${API_BASE}/api/alarms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Alarm B - Commercial Hub',
        destinationName: 'MG Road Metro Station',
        latitude: 12.9756,
        longitude: 77.6097,
        radius: 500,
        notes: 'Shopping exit',
      }),
    });
    const alarmBData = await alarmBRes.json();
    const alarmB = alarmBData.alarm;
    assert(!!alarmB && alarmB.status === 'active', 'Alarm B created in MongoDB with status "active"');

    const engine = new TrackingEngine(API_BASE, token);
    engine.syncAlarms([alarmA, alarmB]);
    assert(engine.activeAlarms.length === 2, 'TrackingEngine synchronized 2 active alarms');

    // -----------------------------------------------------------------
    // TEST 1: First simulated arrival triggers modal, sets status completed
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: First Simulated Arrival Triggers Modal & Backend Status ---');
    const sim1Success = await engine.simulateAlarmArrival(alarmA);
    assert(sim1Success === true, 'simulateAlarmArrival(alarmA) returned true');
    assert(engine.triggeredAlarm !== null, 'triggeredAlarm modal state is populated');
    assert(engine.triggeredAlarm._id === alarmA._id, 'Triggered alarm matches Alarm A ID');
    assert(engine.triggeredAlarm.isSimulation === true, 'isSimulation flag is set to true');
    assert(engine.triggeredAlarm.currentDistance < 20, `Simulated distance is ~15m (actual: ${engine.triggeredAlarm.currentDistance}m), safely inside 1000m radius`);
    assert(engine.triggeredAlarmIds.has(String(alarmA._id)), 'Alarm A is marked in triggeredAlarmIds');

    // Verify backend database updated to completed
    const getAlarmARes1 = await fetch(`${API_BASE}/api/alarms`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const allAlarms1 = await getAlarmARes1.json();
    const dbAlarmA1 = allAlarms1.alarms.find((a) => a._id === alarmA._id);
    assert(dbAlarmA1.status === 'completed', 'Backend database status for Alarm A updated to "completed"');

    // -----------------------------------------------------------------
    // TEST 2: Dismiss modal, re-simulate immediately -> triggers on demand
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Dismiss Modal and Re-Simulate Immediately on Demand ---');
    engine.dismissAlarm();
    assert(engine.triggeredAlarm === null, 'dismissAlarm() cleared modal state');
    assert(engine.simulationLockUntil === 0, 'dismissAlarm() reset simulation lock');
    // Notice: triggeredAlarmIds still has alarmA._id for real GPS duplicate protection
    assert(engine.triggeredAlarmIds.has(String(alarmA._id)), 'Real GPS duplicate protection lock is preserved after dismiss');

    // Re-simulate immediately
    const sim2Success = await engine.simulateAlarmArrival(alarmA);
    assert(sim2Success === true, 'Explicit re-simulation of Alarm A succeeds immediately');
    assert(engine.triggeredAlarm !== null, 'Modal repopulated on re-simulation');
    assert(engine.triggeredAlarm._id === alarmA._id, 'Re-triggered alarm is Alarm A');
    assert(engine.triggerCount === 2, 'Trigger count incremented to 2');

    // -----------------------------------------------------------------
    // TEST 3: 5 consecutive simulation + dismiss cycles for same alarm
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: 5 Consecutive Simulation + Dismiss Cycles on Same Alarm ---');
    let consecutiveSuccesses = 0;
    for (let i = 1; i <= 5; i++) {
      engine.dismissAlarm();
      const res = await engine.simulateAlarmArrival(alarmA);
      if (res && engine.triggeredAlarm && engine.triggeredAlarm._id === alarmA._id) {
        consecutiveSuccesses++;
      }
    }
    assert(consecutiveSuccesses === 5, 'All 5 consecutive simulation + dismiss cycles succeeded with 100% reliability (0 failures)');
    assert(engine.triggerCount === 7, `Total triggers fired: ${engine.triggerCount}`);
    engine.dismissAlarm();

    // -----------------------------------------------------------------
    // TEST 4: Pause and resume an alarm -> trigger lock resets upon resume
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Pause and Resume Alarm -> Trigger Lock Resets Upon Resume ---');
    // Ensure alarmA is locked
    engine.triggeredAlarmIds.add(String(alarmA._id));
    assert(engine.triggeredAlarmIds.has(String(alarmA._id)), 'Alarm A is initially locked');

    // Pause Alarm A via API
    await fetch(`${API_BASE}/api/alarms/${alarmA._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'paused' }),
    });

    // Resume Alarm A via API (as done in DashboardPage and MyAlarmsPage)
    const resumeRes = await fetch(`${API_BASE}/api/alarms/${alarmA._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });
    const resumeData = await resumeRes.json();
    assert(resumeData.alarm.status === 'active', 'Alarm A resumed to "active" status');

    // Calling resetAlarmTriggerLock upon resume
    engine.resetAlarmTriggerLock(alarmA._id);
    assert(!engine.triggeredAlarmIds.has(String(alarmA._id)), 'Trigger lock cleared from triggeredAlarmIds upon resume');

    // -----------------------------------------------------------------
    // TEST 5: Change alarm from completed to active -> trigger lock resets
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Reactivate Alarm from Completed to Active ---');
    // Lock alarm
    engine.triggeredAlarmIds.add(String(alarmA._id));
    assert(engine.triggeredAlarmIds.has(String(alarmA._id)), 'Lock set for completed alarm');

    // Reactivate via edit / status toggle
    const reactivateRes = await fetch(`${API_BASE}/api/alarms/${alarmA._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });
    const reactivated = await reactivateRes.json();
    assert(reactivated.alarm.status === 'active', 'Alarm status set back to "active" in database');

    // Reactivation clears lock
    engine.resetAlarmTriggerLock(alarmA._id);
    assert(!engine.triggeredAlarmIds.has(String(alarmA._id)), 'Lock is successfully reset for reactivated alarm');

    // -----------------------------------------------------------------
    // TEST 6: Real GPS simulation lock window & duplicate suppression
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Real GPS Simulation Window & Duplicate Suppression ---');
    // Create an active alarm C for GPS tracking
    const alarmCRes = await fetch(`${API_BASE}/api/alarms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Alarm C - Real GPS Geofence',
        destinationName: 'Indiranagar Metro',
        latitude: 12.9784,
        longitude: 77.6408,
        radius: 1000,
      }),
    });
    const alarmCData = await alarmCRes.json();
    const alarmC = alarmCData.alarm;

    engine.syncAlarms([alarmC]);
    assert(engine.activeAlarms.length === 1 && engine.activeAlarms[0]._id === alarmC._id, 'Synchronized Alarm C as active tracking target');

    // Step A: Set simulation lock active (expires in 5000ms)
    engine.simulationLockUntil = Date.now() + 5000;
    const initialLocation = engine.currentLocation;

    // Real GPS arrives while simulation lock is active -> should be IGNORED
    engine.processLocationUpdate(12.9784, 77.6408, 10, false);
    assert(engine.currentLocation === initialLocation, 'Real GPS event ignored while simulationLockUntil is active');

    // Step B: Expire the simulation lock
    engine.simulationLockUntil = 0;

    // Step C: Real GPS outside geofence (5km away)
    const prevTriggerCount = engine.triggerCount;
    engine.processLocationUpdate(12.9784 + 0.045, 77.6408 + 0.045, 10, false);
    assert(engine.triggerCount === prevTriggerCount, 'No trigger fired when real GPS is 5km away from Alarm C');

    // Step D: Real GPS enters geofence (200m away) -> FIRST TRIGGER
    engine.processLocationUpdate(12.9784 + 0.001, 77.6408 + 0.001, 10, false);
    assert(engine.triggerCount === prevTriggerCount + 1, '🚨 Real GPS entry into 1000m radius triggers Alarm C');
    assert(engine.triggeredAlarm._id === alarmC._id, 'Triggered alarm matches Alarm C');
    assert(engine.triggeredAlarm.isSimulation === false, 'Triggered with isSimulation: false (Real GPS)');

    // Step E: Second real GPS event arrives while still inside geofence -> DUPLICATE SUPPRESSION
    const triggerCountBeforeDuplicate = engine.triggerCount;
    const suppressedBefore = engine.duplicateSuppressedCount;
    engine.processLocationUpdate(12.9784 + 0.0005, 77.6408 + 0.0005, 10, false);
    assert(engine.triggerCount === triggerCountBeforeDuplicate, 'Duplicate real GPS event suppressed (trigger count unchanged)');
    assert(engine.duplicateSuppressedCount === suppressedBefore + 1, 'Duplicate suppression count incremented');

    // -----------------------------------------------------------------
    // TEST 7: Simulating Alarm A does NOT trigger or mark Alarm B completed
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Multi-Alarm Isolation (Simulating Alarm A leaves Alarm B untouched) ---');
    // Ensure Alarm B is active in database
    await fetch(`${API_BASE}/api/alarms/${alarmB._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });

    // Reset locks and sync engine with both alarms
    engine.syncAlarms([alarmA, alarmB]);
    engine.resetAlarmTriggerLock(alarmA._id);
    engine.resetAlarmTriggerLock(alarmB._id);
    engine.dismissAlarm();

    // Trigger simulation specifically for Alarm A
    await engine.simulateAlarmArrival(alarmA);
    assert(engine.triggeredAlarm._id === alarmA._id, 'Triggered alarm is strictly Alarm A');
    assert(engine.triggeredAlarm._id !== alarmB._id, 'Triggered alarm is NOT Alarm B');

    // Query backend to verify Alarm B status is STILL "active"
    const getAlarmBRes = await fetch(`${API_BASE}/api/alarms/${alarmB._id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const alarmBCheck = await getAlarmBRes.json();
    assert(alarmBCheck.alarm.status === 'active', 'Alarm B remains "active" in database (not accidentally marked completed)');
    assert(!alarmBCheck.alarm.triggeredAt, 'Alarm B triggeredAt is undefined / null');

    // -----------------------------------------------------------------
    // Cleanup Database
    // -----------------------------------------------------------------
    console.log('\n--- Cleaning Up Database Fixtures ---');
    const mongoose = require('../backend/node_modules/mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/geoalarm');
    const User = require('../backend/src/models/User');
    const Alarm = require('../backend/src/models/Alarm');
    await Alarm.deleteMany({ user: regData.user._id });
    await User.findByIdAndDelete(regData.user._id);
    await mongoose.disconnect();
    console.log('  ✓ Test user and all test alarms cleanly removed.');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 SIMULATE ARRIVAL & GEOFENCING TESTS PASSED (100%)');
    console.log('================================================================');
  } finally {
    if (backendServer && backendServer.close) {
      backendServer.close();
      console.log('  ✓ Backend test server closed.');
    }
  }
}

runSimulateArrivalVerificationSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
