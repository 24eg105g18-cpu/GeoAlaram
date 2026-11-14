/**
 * Comprehensive Automated Test Suite for GeoAlarm Backend REST APIs.
 * Tests:
 * 1. Health endpoint
 * 2. User registration (validation, duplicate rejection, password hiding)
 * 3. User login (invalid credentials rejection, JWT issuance)
 * 4. Protected /me and /profile endpoints (auth guard, token verification)
 * 5. Alarm creation (coordinate validation, user attachment)
 * 6. Alarm retrieval (list, stats, single item)
 * 7. Multi-user isolation (User B CANNOT view, update, or delete User A's alarms)
 * 8. Alarm status toggle (pause, resume, complete with triggeredAt)
 * 9. Alarm update and delete operations
 * 10. Haversine distance and geofence calculation
 */

const http = require('http');
const mongoose = require('mongoose');
const { app, startServer } = require('./src/index');
const { calculateDistance, isInsideRadius } = require('./src/utils/haversine');
const User = require('./src/models/User');
const Alarm = require('./src/models/Alarm');

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Helper function to send HTTP requests
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('======================================================');
  console.log('🚀 STARTING COMPREHENSIVE GEOALARM BACKEND TEST SUITE');
  console.log('======================================================\n');

  const server = await startServer();

  try {
    // -----------------------------------------------------------------
    // TEST 1: Health Check
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Health Check Endpoint ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint responds with 200 OK');
    assert(health.body.database === 'connected', 'Database status reports "connected"');

    // -----------------------------------------------------------------
    // TEST 2: User Registration & Validation
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: User Registration & Validation ---');
    const userAEmail = `user_a_${Date.now()}@test.com`;

    // 2.1 Validation: short password
    const shortPwd = await request('POST', '/api/auth/register', {
      name: 'Alice Traveller',
      email: userAEmail,
      password: '123',
    });
    assert(shortPwd.status === 400, 'Rejects password shorter than 6 characters');

    // 2.2 Validation: invalid email
    const badEmail = await request('POST', '/api/auth/register', {
      name: 'Alice Traveller',
      email: 'not-an-email',
      password: 'password123',
    });
    assert(badEmail.status === 400, 'Rejects invalid email format');

    // 2.3 Successful registration
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Alice Traveller',
      email: userAEmail,
      password: 'Password123!',
    });
    assert(regRes.status === 201, 'User A registered successfully with status 201');
    assert(!!regRes.body.token, 'Registration returns a valid JWT token');
    assert(!regRes.body.user.password, 'Password hash is NOT exposed in response');
    assert(regRes.body.user.email === userAEmail, 'User email matches registered email');

    const tokenA = regRes.body.token;
    const userAId = regRes.body.user._id;

    // 2.4 Duplicate email rejection
    const dupRes = await request('POST', '/api/auth/register', {
      name: 'Duplicate Alice',
      email: userAEmail,
      password: 'Password123!',
    });
    assert(dupRes.status === 400, 'Duplicate email registration is rejected with 400');

    // -----------------------------------------------------------------
    // TEST 3: User Login
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: User Login ---');
    // 3.1 Wrong password
    const wrongPwd = await request('POST', '/api/auth/login', {
      email: userAEmail,
      password: 'WrongPassword!',
    });
    assert(wrongPwd.status === 401, 'Rejects incorrect password with 401');

    // 3.2 Non-existent email
    const nonExistent = await request('POST', '/api/auth/login', {
      email: 'ghost@nowhere.com',
      password: 'Password123!',
    });
    assert(nonExistent.status === 401, 'Rejects unregistered email with 401');

    // 3.3 Successful login
    const loginRes = await request('POST', '/api/auth/login', {
      email: userAEmail,
      password: 'Password123!',
    });
    assert(loginRes.status === 200, 'Login succeeds with status 200');
    assert(!!loginRes.body.token, 'Login returns new JWT token');
    assert(!loginRes.body.user.password, 'Login response does not leak password hash');

    // -----------------------------------------------------------------
    // TEST 4: Protected Profile Endpoint (/api/auth/me)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Protected Auth Guard (/api/auth/me) ---');
    // 4.1 No token
    const noToken = await request('GET', '/api/auth/me');
    assert(noToken.status === 401, 'Blocks request without token (401 Unauthorized)');

    // 4.2 Bad token
    const badToken = await request('GET', '/api/auth/me', null, 'invalid_token_xyz');
    assert(badToken.status === 401, 'Blocks request with invalid token');

    // 4.3 Valid token
    const meRes = await request('GET', '/api/auth/me', null, tokenA);
    assert(meRes.status === 200, 'Allows request with valid token');
    assert(meRes.body.user._id === userAId, 'Returns correct user profile');

    // 4.4 Update profile name
    const updateRes = await request(
      'PUT',
      '/api/auth/profile',
      { name: 'Alice Super Traveller' },
      tokenA
    );
    assert(updateRes.status === 200, 'Profile updated successfully');
    assert(updateRes.body.user.name === 'Alice Super Traveller', 'Updated name reflected');

    // -----------------------------------------------------------------
    // TEST 5: Create Alarm & Input Validation
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Create Alarm & Validation ---');
    // 5.1 Missing destination
    const missingDest = await request(
      'POST',
      '/api/alarms',
      { name: 'Airport Stop', latitude: 13.1986, longitude: 77.7066 },
      tokenA
    );
    assert(missingDest.status === 400, 'Rejects alarm without destinationName');

    // 5.2 Invalid latitude
    const badLat = await request(
      'POST',
      '/api/alarms',
      { name: 'Invalid Lat', destinationName: 'Test', latitude: 120, longitude: 77.7 },
      tokenA
    );
    assert(badLat.status === 400, 'Rejects latitude outside [-90, 90]');

    // 5.3 Successful alarm creation
    const alarmRes = await request(
      'POST',
      '/api/alarms',
      {
        name: 'Kempegowda International Airport Terminal 1',
        destinationName: 'Devanahalli, Bengaluru, Karnataka 560300',
        latitude: 13.1986,
        longitude: 77.7066,
        radius: 2000,
        notes: 'Take departure gate 3',
      },
      tokenA
    );
    assert(alarmRes.status === 201, 'Alarm created successfully with 201');
    assert(alarmRes.body.alarm.radius === 2000, 'Alarm radius set to 2000m');
    assert(alarmRes.body.alarm.status === 'active', 'Alarm status defaults to "active"');
    const alarmAId = alarmRes.body.alarm._id;

    // Create a 2nd alarm for user A
    const alarmRes2 = await request(
      'POST',
      '/api/alarms',
      {
        name: 'Majestic Bus Terminal',
        destinationName: 'Kempegowda Bus Station, Platform 12',
        latitude: 12.9772,
        longitude: 77.5713,
        radius: 1000,
      },
      tokenA
    );
    assert(alarmRes2.status === 201, 'Second alarm created successfully');
    const alarmA2Id = alarmRes2.body.alarm._id;

    // -----------------------------------------------------------------
    // TEST 6: Get Alarms & Statistics
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Get Alarms & Statistics ---');
    const listRes = await request('GET', '/api/alarms', null, tokenA);
    assert(listRes.status === 200, 'Alarms fetched successfully with status 200');
    assert(listRes.body.count === 2, 'Fetched 2 alarms for User A');
    assert(listRes.body.stats.active === 2, 'Stats indicate 2 active alarms');
    assert(listRes.body.stats.total === 2, 'Stats indicate 2 total alarms');

    // Get single alarm by ID
    const singleRes = await request('GET', `/api/alarms/${alarmAId}`, null, tokenA);
    assert(singleRes.status === 200, 'Fetched single alarm by ID');
    assert(singleRes.body.alarm._id === alarmAId, 'Alarm ID matches requested ID');

    // -----------------------------------------------------------------
    // TEST 7: Multi-Tenant Data Isolation (User B cannot access User A)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Multi-Tenant User Isolation ---');
    const userBEmail = `user_b_${Date.now()}@test.com`;
    const regB = await request('POST', '/api/auth/register', {
      name: 'Bob Commuter',
      email: userBEmail,
      password: 'Password123!',
    });
    const tokenB = regB.body.token;

    // User B gets their alarms - should be empty!
    const listB = await request('GET', '/api/alarms', null, tokenB);
    assert(listB.body.count === 0, "User B's alarm list is empty (0 alarms)");

    // User B tries to view User A's alarm
    const stealView = await request('GET', `/api/alarms/${alarmAId}`, null, tokenB);
    assert(stealView.status === 404, "User B cannot view User A's alarm (404 Not Found)");

    // User B tries to update User A's alarm
    const stealUpdate = await request(
      'PUT',
      `/api/alarms/${alarmAId}`,
      { name: 'Hacked Alarm Name' },
      tokenB
    );
    assert(stealUpdate.status === 404, "User B cannot update User A's alarm (404 Not Found)");

    // User B tries to delete User A's alarm
    const stealDelete = await request('DELETE', `/api/alarms/${alarmAId}`, null, tokenB);
    assert(stealDelete.status === 404, "User B cannot delete User A's alarm (404 Not Found)");

    // -----------------------------------------------------------------
    // TEST 8: Pause, Resume, and Complete Alarm Functionality
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: Pause, Resume, and Complete Alarm ---');
    // 8.1 Pause alarm
    const pauseRes = await request(
      'PATCH',
      `/api/alarms/${alarmAId}/status`,
      { status: 'paused' },
      tokenA
    );
    assert(pauseRes.status === 200, 'Alarm status paused successfully');
    assert(pauseRes.body.alarm.status === 'paused', 'Status updated to "paused"');

    // 8.2 Resume alarm
    const resumeRes = await request(
      'PATCH',
      `/api/alarms/${alarmAId}/status`,
      { status: 'active' },
      tokenA
    );
    assert(resumeRes.status === 200, 'Alarm status resumed to active');
    assert(resumeRes.body.alarm.status === 'active', 'Status updated to "active"');

    // 8.3 Complete alarm (trigger)
    const completeRes = await request(
      'PATCH',
      `/api/alarms/${alarmAId}/status`,
      { status: 'completed' },
      tokenA
    );
    assert(completeRes.status === 200, 'Alarm completed/triggered successfully');
    assert(completeRes.body.alarm.status === 'completed', 'Status updated to "completed"');
    assert(!!completeRes.body.alarm.triggeredAt, 'triggeredAt timestamp is recorded');

    // -----------------------------------------------------------------
    // TEST 9: Update and Delete Alarm
    // -----------------------------------------------------------------
    console.log('\n--- TEST 9: Update and Delete Alarm ---');
    // 9.1 Update alarm
    const updateAlarmRes = await request(
      'PUT',
      `/api/alarms/${alarmA2Id}`,
      {
        name: 'Majestic Bus Terminal (Updated)',
        radius: 500,
      },
      tokenA
    );
    assert(updateAlarmRes.status === 200, 'Alarm updated successfully');
    assert(updateAlarmRes.body.alarm.radius === 500, 'Alarm radius changed to 500m');
    assert(updateAlarmRes.body.alarm.name === 'Majestic Bus Terminal (Updated)', 'Name updated');

    // 9.2 Delete alarm
    const deleteAlarmRes = await request('DELETE', `/api/alarms/${alarmA2Id}`, null, tokenA);
    assert(deleteAlarmRes.status === 200, 'Alarm deleted successfully');

    // 9.3 Verify deletion
    const verifyDel = await request('GET', `/api/alarms/${alarmA2Id}`, null, tokenA);
    assert(verifyDel.status === 404, 'Deleted alarm can no longer be retrieved (404)');

    // -----------------------------------------------------------------
    // TEST 10: Haversine Calculation & Geofence Logic
    // -----------------------------------------------------------------
    console.log('\n--- TEST 10: Haversine Distance & Geofence Evaluation ---');
    // Bangalore City Railway Station (12.9784, 77.5694) to Kempegowda Bus Station (12.9772, 77.5713)
    // Real distance is ~245 meters
    const distMeters = calculateDistance(12.9784, 77.5694, 12.9772, 77.5713);
    assert(distMeters > 200 && distMeters < 300, `Haversine distance accurate (~${distMeters}m)`);

    // Proximity check with 500m radius (should be inside)
    const insideCheck = isInsideRadius(12.9784, 77.5694, 12.9772, 77.5713, 500);
    assert(insideCheck.isWithinRadius === true, 'Correctly evaluates inside radius (within 500m)');

    // Proximity check with 100m radius (should be outside)
    const outsideCheck = isInsideRadius(12.9784, 77.5694, 12.9772, 77.5713, 100);
    assert(outsideCheck.isWithinRadius === false, 'Correctly evaluates outside radius (outside 100m)');

    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    console.log('\n--- CLEANUP ---');
    await Alarm.deleteMany({ user: { $in: [userAId, regB.body.user._id] } });
    await User.deleteMany({ _id: { $in: [userAId, regB.body.user._id] } });
    console.log('  ✓ Test database records cleaned up cleanly.');

    console.log('\n======================================================');
    console.log('🎉 ALL 10 TESTS PASSED! BACKEND REST APIS 100% VERIFIED');
    console.log('======================================================');

    server.close(() => {
      mongoose.disconnect().then(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTestSuite();
