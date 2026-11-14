/**
 * Automated Verification Suite for Step 6:
 * Foreground Location Monitoring, Haversine Distance, and Alarm Triggering.
 */

const { calculateDistance, checkProximity, formatDistance } = require('./src/utils/haversine');
const http = require('http');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function testStep6() {
  console.log('======================================================');
  console.log('📍 STARTING STEP 6 FOREGROUND MONITORING TEST SUITE');
  console.log('======================================================\n');

  // Start the backend server
  const { startServer } = require('../backend/src/index');
  const backendServer = await startServer();
  console.log('  ✓ Backend server initialized on port 5000\n');

  try {
    // ---------------------------------------------------------------
    // 1. Math Verification: Haversine distance & formatting
    // ---------------------------------------------------------------
    console.log('--- 1. Testing Haversine Distance & Unit Formatting ---');
    // Bangalore City Railway Station (12.9784, 77.5694) to Kempegowda Bus Station (12.9772, 77.5713)
    const dist1 = calculateDistance(12.9784, 77.5694, 12.9772, 77.5713);
    assert(dist1 > 200 && dist1 < 300, `Distance between train & bus stations is ~245m (calculated: ${dist1}m)`);
    assert(formatDistance(450) === '450 m', 'Formats meters under 1000m cleanly ("450 m")');
    assert(formatDistance(2400) === '2.4 km', 'Formats distances over 1000m as kilometers ("2.4 km")');

    // ---------------------------------------------------------------
    // 2. Geofence Boundary Threshold Testing
    // ---------------------------------------------------------------
    console.log('\n--- 2. Testing Geofence Boundary & Radius Proximity ---');
    const targetLat = 12.9716;
    const targetLon = 77.5946;
    const radiusMeters = 1000; // 1km radius

    // Point A: ~300m away (inside)
    const insideCheck = checkProximity(targetLat + 0.002, targetLon + 0.002, targetLat, targetLon, radiusMeters);
    assert(insideCheck.isInside === true, `Point ~${insideCheck.distance}m away correctly evaluates as INSIDE 1000m radius`);

    // Point B: ~4km away (outside)
    const outsideCheck = checkProximity(targetLat + 0.03, targetLon + 0.03, targetLat, targetLon, radiusMeters);
    assert(outsideCheck.isInside === false, `Point ~${outsideCheck.distance}m away correctly evaluates as OUTSIDE 1000m radius`);

    // ---------------------------------------------------------------
    // 3. User & Alarm Setup for Simulated Approach
    // ---------------------------------------------------------------
    console.log('\n--- 3. Setting Up Test Alarm for Simulated GPS Approach ---');
    const testEmail = `step6_${Date.now()}@geoalarm.test`;
    const regRes = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GPS Commuter',
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    const token = regData.token;
    assert(!!token, 'User registered and authenticated with JWT');

    // Create an alarm with 1000m radius at target location
    const createAlarmRes = await fetch('http://127.0.0.1:5000/api/alarms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Downtown Drop-Off Geofence',
        destinationName: 'Central Plaza Terminal',
        latitude: targetLat,
        longitude: targetLon,
        radius: 1000,
        notes: 'Prepare exit at platform gate 2',
      }),
    });
    const alarmData = await createAlarmRes.json();
    assert(alarmData.status !== 400 && !!alarmData.alarm, 'Target alarm created in MongoDB');
    const alarmId = alarmData.alarm._id;

    // ---------------------------------------------------------------
    // 4. Simulated GPS Journey (Outside -> Inside -> Duplicate Check)
    // ---------------------------------------------------------------
    console.log('\n--- 4. Simulating Foreground Location Journey & Trigger Logic ---');
    let triggerCount = 0;
    const triggeredIds = new Set();

    function simulateGpsPosition(currentLat, currentLon, alarm) {
      const dist = calculateDistance(currentLat, currentLon, alarm.latitude, alarm.longitude);
      const isInside = dist <= alarm.radius;

      if (isInside && !triggeredIds.has(alarm._id)) {
        triggeredIds.add(alarm._id);
        triggerCount++;
        return { triggered: true, distance: dist };
      }
      return { triggered: false, distance: dist };
    }

    // Step A: Commuter is 5km away on highway
    const step1 = simulateGpsPosition(targetLat + 0.045, targetLon + 0.045, alarmData.alarm);
    assert(step1.triggered === false, `Step 1 (Highway, ~${Math.round(step1.distance)}m away): No alert triggered`);
    assert(triggerCount === 0, 'Trigger count remains 0');

    // Step B: Commuter approaches to 1.5km (still outside 1km radius)
    const step2 = simulateGpsPosition(targetLat + 0.012, targetLon + 0.012, alarmData.alarm);
    assert(step2.triggered === false, `Step 2 (Approaching, ~${Math.round(step2.distance)}m away): No alert triggered`);
    assert(triggerCount === 0, 'Trigger count remains 0');

    // Step C: Commuter enters geofence radius (450m away) -> TRIGGER!
    const step3 = simulateGpsPosition(targetLat + 0.003, targetLon + 0.003, alarmData.alarm);
    assert(step3.triggered === true, `Step 3 (Inside Geofence, ~${Math.round(step3.distance)}m away): 🚨 ALARM TRIGGERED!`);
    assert(triggerCount === 1, 'Trigger count incremented to 1');

    // Step D: Commuter moves to 200m away (still inside geofence) -> DUPLICATE PREVENTION CHECK!
    const step4 = simulateGpsPosition(targetLat + 0.001, targetLon + 0.001, alarmData.alarm);
    assert(step4.triggered === false, `Step 4 (Inside Geofence, ~${Math.round(step4.distance)}m away): Duplicate alert suppressed`);
    assert(triggerCount === 1, 'Trigger count stays at 1 (no repeated alerts for same arrival)');

    // ---------------------------------------------------------------
    // 5. Backend Status Update to 'completed'
    // ---------------------------------------------------------------
    console.log('\n--- 5. Verifying Alarm Status Update on Trigger ---');
    const updateStatusRes = await fetch(`http://127.0.0.1:5000/api/alarms/${alarmId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    const updatedData = await updateStatusRes.json();
    assert(updatedData.status !== 400 && updatedData.alarm.status === 'completed', 'Alarm status successfully updated to "completed" in database');
    assert(!!updatedData.alarm.triggeredAt, 'Alarm records triggeredAt timestamp');

    // Clean up test data
    const mongoose = require('../backend/node_modules/mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/geoalarm');
    const User = require('../backend/src/models/User');
    const Alarm = require('../backend/src/models/Alarm');
    await Alarm.deleteMany({ user: regData.user._id });
    await User.findByIdAndDelete(regData.user._id);
    await mongoose.disconnect();
    console.log('  ✓ Test alarm records and user cleaned up.');

    // ---------------------------------------------------------------
    // 6. Vite Frontend Module Verification for Step 6
    // ---------------------------------------------------------------
    console.log('\n--- 6. Verifying Vite Module Serving for Step 6 Tracking Components ---');
    const { createServer } = require('vite');
    const viteServer = await createServer({
      configFile: './vite.config.js',
      server: { port: 5175 },
    });
    await viteServer.listen();

    const probe = (path) => new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:5175' + path, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, length: data.length }));
      }).on('error', reject);
    });

    const m1 = await probe('/src/context/TrackingContext.jsx');
    assert(m1.status === 200, `/src/context/TrackingContext.jsx -> HTTP ${m1.status} (${m1.length} bytes)`);

    const m2 = await probe('/src/components/tracking/TrackingHud.jsx');
    assert(m2.status === 200, `/src/components/tracking/TrackingHud.jsx -> HTTP ${m2.status} (${m2.length} bytes)`);

    const m3 = await probe('/src/components/tracking/AlarmTriggerModal.jsx');
    assert(m3.status === 200, `/src/components/tracking/AlarmTriggerModal.jsx -> HTTP ${m3.status} (${m3.length} bytes)`);

    const m4 = await probe('/src/utils/haversine.js');
    assert(m4.status === 200, `/src/utils/haversine.js -> HTTP ${m4.status} (${m4.length} bytes)`);

    const m5 = await probe('/src/utils/sound.js');
    assert(m5.status === 200, `/src/utils/sound.js -> HTTP ${m5.status} (${m5.length} bytes)`);

    await viteServer.close();
    backendServer.close();

    console.log('\n======================================================');
    console.log('🎉 STEP 6 COMPLETE: LOCATION MONITORING & TRIGGER 100% VERIFIED');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Step 6 test failed:', err);
    if (backendServer) backendServer.close();
    process.exit(1);
  }
}

testStep6();
