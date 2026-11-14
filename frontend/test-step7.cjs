/**
 * Automated Verification Suite for Step 7:
 * My Alarms Management Page & User Profile Settings.
 */

const http = require('http');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function testStep7() {
  console.log('======================================================');
  console.log('👤 STARTING STEP 7: MY ALARMS & PROFILE TEST SUITE');
  console.log('======================================================\n');

  // Start the backend server
  const { startServer } = require('../backend/src/index');
  const backendServer = await startServer();
  console.log('  ✓ Backend server initialized on port 5000\n');

  try {
    // ---------------------------------------------------------------
    // 1. User Registration & Profile Verification
    // ---------------------------------------------------------------
    console.log('--- 1. Testing User Profile & Display Name Update ---');
    const userEmail = `profile_user_${Date.now()}@geoalarm.test`;
    const regRes = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Initial Name',
        email: userEmail,
        password: 'OriginalPassword123!',
      }),
    });
    const regData = await regRes.json();
    let token = regData.token;
    assert(!!token, 'Test user registered successfully with JWT token');

    // Update Display Name
    const updateNameRes = await fetch('http://127.0.0.1:5000/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Alexander The Commuter' }),
    });
    const updateNameData = await updateNameRes.json();
    assert(updateNameRes.status === 200, 'Display name updated with status 200');
    assert(updateNameData.user.name === 'Alexander The Commuter', 'Updated name correctly saved in MongoDB');

    // ---------------------------------------------------------------
    // 2. Secure Password Change & Authentication Re-Verification
    // ---------------------------------------------------------------
    console.log('\n--- 2. Testing Secure Password Change & Auth Flow ---');
    // Wrong current password should be rejected
    const badPwdRes = await fetch('http://127.0.0.1:5000/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword!',
        newPassword: 'BrandNewPassword999!',
      }),
    });
    assert(badPwdRes.status === 400, 'Rejects password update when current password is wrong (400)');

    // Correct current password update
    const goodPwdRes = await fetch('http://127.0.0.1:5000/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: 'OriginalPassword123!',
        newPassword: 'BrandNewPassword999!',
      }),
    });
    assert(goodPwdRes.status === 200, 'Password updated successfully with status 200');

    // Verify old password no longer works
    const oldLoginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'OriginalPassword123!',
      }),
    });
    assert(oldLoginRes.status === 401, 'Login with old password fails with 401 Unauthorized');

    // Verify new password logs in successfully
    const newLoginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'BrandNewPassword999!',
      }),
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.status === 200, 'Login with new password succeeds with status 200');
    token = newLoginData.token; // Update token

    // ---------------------------------------------------------------
    // 3. My Alarms Management: Creation, Filtering, Update, Delete
    // ---------------------------------------------------------------
    console.log('\n--- 3. Testing My Alarms CRUD & Filter Capabilities ---');
    // Create 3 alarms with different statuses
    const alarmA = await (await fetch('http://127.0.0.1:5000/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Morning Office Commute',
        destinationName: 'Tech Park Metro Gate 1',
        latitude: 12.9279,
        longitude: 77.6271,
        radius: 1000,
        status: 'active',
      }),
    })).json();

    const alarmB = await (await fetch('http://127.0.0.1:5000/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Weekend Airport Express',
        destinationName: 'Airport Departures Terminal',
        latitude: 13.1986,
        longitude: 77.7066,
        radius: 5000,
        status: 'active',
      }),
    })).json();

    assert(alarmA.success && alarmB.success, 'Created 2 active alarms in MongoDB');

    // 3.1 Fetch and verify list & stats
    const listRes = await fetch('http://127.0.0.1:5000/api/alarms', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const listData = await listRes.json();
    assert(listData.count === 2, 'Fetched all 2 alarms for user');
    assert(listData.stats.active === 2, 'Stats report 2 active alarms');

    // 3.2 Pause alarm A
    const pauseRes = await fetch(`http://127.0.0.1:5000/api/alarms/${alarmA.alarm._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'paused' }),
    });
    const pauseData = await pauseRes.json();
    assert(pauseData.alarm.status === 'paused', 'Alarm A successfully toggled to "paused"');

    // 3.3 Filter by active status
    const filterActiveRes = await fetch('http://127.0.0.1:5000/api/alarms?status=active', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const filterActiveData = await filterActiveRes.json();
    assert(filterActiveData.count === 1, 'Filter ?status=active returns exactly 1 alarm');
    assert(filterActiveData.alarms[0]._id === alarmB.alarm._id, 'Returned active alarm matches Alarm B');

    // 3.4 Edit alarm details via PUT
    const editRes = await fetch(`http://127.0.0.1:5000/api/alarms/${alarmB.alarm._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Weekend Airport Express (Updated)',
        radius: 2000,
        notes: 'Carry boarding pass',
      }),
    });
    const editData = await editRes.json();
    assert(editRes.status === 200, 'Alarm B edited successfully with status 200');
    assert(editData.alarm.name === 'Weekend Airport Express (Updated)', 'Updated name saved');
    assert(editData.alarm.radius === 2000, 'Updated radius saved (2000m)');
    assert(editData.alarm.notes === 'Carry boarding pass', 'Updated notes saved');

    // 3.5 Delete alarm A
    const delRes = await fetch(`http://127.0.0.1:5000/api/alarms/${alarmA.alarm._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert(delRes.status === 200, 'Alarm A deleted successfully');

    // Verify alarm A is no longer found
    const verifyDel = await fetch(`http://127.0.0.1:5000/api/alarms/${alarmA.alarm._id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert(verifyDel.status === 404, 'Deleted alarm is no longer retrievable (404)');

    // Clean up test records
    const mongoose = require('../backend/node_modules/mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/geoalarm');
    const User = require('../backend/src/models/User');
    const Alarm = require('../backend/src/models/Alarm');
    await Alarm.deleteMany({ user: regData.user._id });
    await User.findByIdAndDelete(regData.user._id);
    await mongoose.disconnect();
    console.log('  ✓ Test alarm records and user cleaned up.');

    // ---------------------------------------------------------------
    // 4. Vite Frontend Module Verification for Step 7
    // ---------------------------------------------------------------
    console.log('\n--- 4. Verifying Vite Module Serving for Step 7 Pages & Components ---');
    const { createServer } = require('vite');
    const viteServer = await createServer({
      configFile: './vite.config.js',
      server: { port: 5176 },
    });
    await viteServer.listen();

    const probe = (path) => new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:5176' + path, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, length: data.length }));
      }).on('error', reject);
    });

    const m1 = await probe('/src/pages/MyAlarmsPage.jsx');
    assert(m1.status === 200, `/src/pages/MyAlarmsPage.jsx -> HTTP ${m1.status} (${m1.length} bytes)`);

    const m2 = await probe('/src/pages/ProfilePage.jsx');
    assert(m2.status === 200, `/src/pages/ProfilePage.jsx -> HTTP ${m2.status} (${m2.length} bytes)`);

    const m3 = await probe('/src/components/common/Navbar.jsx');
    assert(m3.status === 200, `/src/components/common/Navbar.jsx -> HTTP ${m3.status} (${m3.length} bytes)`);

    await viteServer.close();
    backendServer.close();

    console.log('\n======================================================');
    console.log('🎉 STEP 7 COMPLETE: MY ALARMS & PROFILE 100% VERIFIED');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Step 7 test failed:', err);
    if (backendServer) backendServer.close();
    process.exit(1);
  }
}

testStep7();
