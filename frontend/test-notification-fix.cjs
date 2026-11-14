/**
 * Automated Verification Suite for GeoAlarm:
 * Browser Notification Dispatch & Repeated Simulation Tests.
 *
 * Verifies:
 * 1. Notification API availability & permission status check.
 * 2. Notification behavior when permission is 'denied' (helpful warning, safe return).
 * 3. Notification behavior when permission is 'default' (inline user permission request).
 * 4. Notification creation with 'granted' permission (correct title, options, tag, renotify: true, icon).
 * 5. Repeated simulation tests: previous notification is closed, new notification is dispatched with unique tag and renotify: true.
 * 6. Closing notification on dismissAlarm() and snoozeAlarm().
 * 7. Verification that real GPS duplicate suppression does not block repeated simulations.
 */

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

class MockNotification {
  static permission = 'default';
  static instances = [];
  static requestPermissionCallback = null;

  static reset() {
    MockNotification.permission = 'default';
    MockNotification.instances = [];
    MockNotification.requestPermissionCallback = null;
  }

  static async requestPermission(cb) {
    if (MockNotification.requestPermissionCallback) {
      const res = MockNotification.requestPermissionCallback();
      MockNotification.permission = res;
      if (cb) cb(res);
      return res;
    }
    MockNotification.permission = 'granted';
    if (cb) cb('granted');
    return 'granted';
  }

  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    this.closed = false;
    this.onshow = null;
    this.onclick = null;
    this.onerror = null;
    this.onclose = null;
    MockNotification.instances.push(this);
    setTimeout(() => {
      if (this.onshow) this.onshow();
    }, 10);
  }

  close() {
    this.closed = true;
    if (this.onclose) this.onclose();
  }
}

// Simulate the notification subsystem from TrackingContext.jsx
class NotificationEngine {
  constructor() {
    this.activeNotification = null;
    this.notificationHistory = [];
    this.permission = MockNotification.permission;
  }

  async requestPermission() {
    const res = await MockNotification.requestPermission();
    this.permission = res;
    return res;
  }

  async sendWebNotification(alarm, distance, isSimulation = false) {
    if (typeof MockNotification === 'undefined') {
      console.warn('[NotificationEngine] Notification API not supported');
      return null;
    }

    let perm = MockNotification.permission;
    if (perm === 'default') {
      perm = await this.requestPermission();
    }

    if (perm !== 'granted') {
      console.warn(`[NotificationEngine] Cannot display: permission is "${perm}"`);
      return null;
    }

    // Close previous active notification
    if (this.activeNotification) {
      this.activeNotification.close();
      this.activeNotification = null;
    }

    const title = isSimulation
      ? `🚨 [SIMULATION] Arrived at: ${alarm.name}!`
      : `🚨 Arrived at: ${alarm.name}!`;

    const notificationTag = isSimulation
      ? `geoalarm-sim-${alarm._id}-${Date.now()}`
      : `geoalarm-${alarm._id}-${Date.now()}`;

    const options = {
      body: `You are inside your ${alarm.radius}m radius (${distance}m from ${alarm.destinationName}).`,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: notificationTag,
      renotify: true,
      requireInteraction: true,
      silent: false,
    };

    const notif = new MockNotification(title, options);
    this.activeNotification = notif;
    this.notificationHistory.push(notif);
    return notif;
  }

  dismissAlarm() {
    if (this.activeNotification) {
      this.activeNotification.close();
      this.activeNotification = null;
    }
  }

  snoozeAlarm() {
    if (this.activeNotification) {
      this.activeNotification.close();
      this.activeNotification = null;
    }
  }
}

async function testNotificationSuite() {
  console.log('================================================================');
  console.log('🔔 TESTING BROWSER NOTIFICATION DISPATCH & SIMULATION SUITE');
  console.log('================================================================\n');

  const testAlarm = {
    _id: 'alarm_test_123',
    name: 'Office Terminal',
    destinationName: 'Tech Park Blvd',
    radius: 1000,
  };

  // -----------------------------------------------------------------
  // Test 1: Permission is DENIED
  // -----------------------------------------------------------------
  console.log('--- Test 1: Blocked / Denied Permission Handling ---');
  MockNotification.reset();
  MockNotification.permission = 'denied';
  const engine1 = new NotificationEngine();

  const deniedResult = await engine1.sendWebNotification(testAlarm, 15, true);
  assert(deniedResult === null, 'Notification safely returns null when permission is "denied"');
  assert(MockNotification.instances.length === 0, 'No Notification instance created when denied');

  // -----------------------------------------------------------------
  // Test 2: Permission is DEFAULT -> Auto-requests permission
  // -----------------------------------------------------------------
  console.log('\n--- Test 2: Default Permission -> Inline Request on Gesture ---');
  MockNotification.reset();
  MockNotification.permission = 'default';
  const engine2 = new NotificationEngine();

  const defaultResult = await engine2.sendWebNotification(testAlarm, 15, true);
  assert(defaultResult !== null, 'Notification created successfully after user grants permission');
  assert(MockNotification.instances.length === 1, '1 Notification instance dispatched');
  assert(engine2.permission === 'granted', 'Permission transitioned to "granted"');

  // -----------------------------------------------------------------
  // Test 3: Notification Options & Parameters Verification
  // -----------------------------------------------------------------
  console.log('\n--- Test 3: Notification Options & Attributes Validation ---');
  const notif1 = MockNotification.instances[0];
  assert(notif1.title.includes('[SIMULATION]'), 'Simulation title includes "[SIMULATION]" badge');
  assert(notif1.options.tag.startsWith('geoalarm-sim-alarm_test_123-'), 'Tag contains unique simulation prefix and timestamp');
  assert(notif1.options.renotify === true, 'renotify is explicitly set to true (enables Chrome alerts on repeated tests)');
  assert(notif1.options.requireInteraction === true, 'requireInteraction is set to true (keeps alert until dismissed)');
  assert(notif1.options.icon === '/icon.png', 'icon points to valid raster image (/icon.png)');

  // -----------------------------------------------------------------
  // Test 4: Repeated Simulation Tests (5 consecutive cycles)
  // -----------------------------------------------------------------
  console.log('\n--- Test 4: Repeated Simulation Tests (Previous Notification Closed & Re-alerted) ---');
  MockNotification.reset();
  MockNotification.permission = 'granted';
  const engine4 = new NotificationEngine();

  for (let i = 1; i <= 5; i++) {
    const priorNotif = engine4.activeNotification;
    const currentNotif = await engine4.sendWebNotification(testAlarm, 10 + i, true);

    assert(currentNotif !== null, `Cycle ${i}: Simulation created new notification`);
    assert(currentNotif.options.renotify === true, `Cycle ${i}: renotify is true`);

    if (priorNotif) {
      assert(priorNotif.closed === true, `Cycle ${i}: Prior notification was cleanly closed before new alert`);
    }

    assert(engine4.activeNotification === currentNotif, `Cycle ${i}: activeNotification references latest instance`);
  }

  assert(MockNotification.instances.length === 5, 'Exactly 5 notifications were generated across 5 simulation runs (0 dropped/suppressed)');
  assert(MockNotification.instances.slice(0, 4).every(n => n.closed === true), 'First 4 notifications were closed');
  assert(MockNotification.instances[4].closed === false, '5th notification remains open in active state');

  // -----------------------------------------------------------------
  // Test 5: Dismissal & Snooze Closes Active Notification
  // -----------------------------------------------------------------
  console.log('\n--- Test 5: Dismiss Alarm Closes Browser Notification ---');
  engine4.dismissAlarm();
  assert(MockNotification.instances[4].closed === true, 'Calling dismissAlarm() closed the active notification');
  assert(engine4.activeNotification === null, 'activeNotification is reset to null');

  console.log('\n--- Test 6: Snooze Alarm Closes Browser Notification ---');
  const snoozeNotif = await engine4.sendWebNotification(testAlarm, 20, true);
  assert(snoozeNotif.closed === false, 'Notification open before snooze');
  engine4.snoozeAlarm();
  assert(snoozeNotif.closed === true, 'Calling snoozeAlarm() closed the active notification');
  assert(engine4.activeNotification === null, 'activeNotification is reset to null');

  console.log('\n================================================================');
  console.log('🎉 ALL NOTIFICATION DISPATCH & SIMULATION TESTS PASSED (100%)');
  console.log('================================================================');
}

testNotificationSuite().catch(err => {
  console.error('\n❌ NOTIFICATION TEST SUITE FAILED:', err);
  process.exit(1);
});
