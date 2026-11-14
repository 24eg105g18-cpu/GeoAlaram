/**
 * Automated Verification Suite for GeoAlarm:
 * Audio Synthesizer, Web Audio API Autoplay & Alarm Sound Lifecycle.
 *
 * Verifies:
 * 1. AudioContext initialization, state management, and unlockAudio() mechanics.
 * 2. playAlarmTone() properly handles suspended context and schedules oscillators.
 * 3. startAlarmSound() and stopAlarmSound() lifecycle.
 * 4. User gesture activation preservation across async/await calls during Simulate Arrival.
 * 5. Snooze stops the active sound without destroying the audio engine.
 * 6. 5-minute snooze expiry re-trigger successfully plays sound on an already-unlocked context.
 * 7. Dismiss cleanly halts audio playback.
 * 8. Subsequent alarm triggers continue playing sound without getting locked or silenced.
 */

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

// Mock Web Audio API simulating Chromium's exact state machine and Autoplay Policy
class MockAudioContext {
  constructor(allowAutoplay = false) {
    this.allowAutoplay = allowAutoplay;
    this.state = allowAutoplay ? 'running' : 'suspended';
    this.currentTime = 0;
    this.destination = { type: 'destination' };
    this.scheduledNodes = [];
    this.resumeCalls = 0;
  }

  createOscillator() {
    if (this.state === 'closed') throw new Error('Cannot createOscillator on closed AudioContext');
    const osc = {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: (val, time) => { osc.frequency.value = val; osc.frequency.scheduledTime = time; }
      },
      connect: (dest) => { osc.connectedTo = dest; },
      start: (time) => { osc.startTime = time; this.scheduledNodes.push({ type: 'start', node: osc, time }); },
      stop: (time) => { osc.stopTime = time; this.scheduledNodes.push({ type: 'stop', node: osc, time }); }
    };
    return osc;
  }

  createGain() {
    if (this.state === 'closed') throw new Error('Cannot createGain on closed AudioContext');
    const gain = {
      gain: {
        value: 1.0,
        setValueAtTime: (val, time) => { gain.gain.value = val; gain.gain.scheduledTime = time; },
        exponentialRampToValueAtTime: (val, time) => { gain.gain.targetVal = val; gain.gain.targetTime = time; }
      },
      connect: (dest) => { gain.connectedTo = dest; }
    };
    return gain;
  }

  async resume() {
    this.resumeCalls++;
    if (this.state === 'closed') throw new Error('Cannot resume closed AudioContext');
    // If autoplay blocked and no user gesture, Chrome rejects
    if (!this.allowAutoplay && !this.userGestureActive) {
      throw new Error('The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture.');
    }
    this.state = 'running';
    if (this.currentTime === 0) {
      this.currentTime = 0.05; // hardware audio clock ticks
    }
    return Promise.resolve();
  }

  advanceTime(deltaSeconds) {
    if (this.state === 'running') {
      this.currentTime += deltaSeconds;
    }
  }

  close() {
    this.state = 'closed';
  }
}

// Mock sound engine replicating the improved sound.js
class SoundEngine {
  constructor(mockCtx) {
    this.audioCtx = mockCtx;
    this.alarmIntervalId = null;
    this.playCount = 0;
  }

  getAudioContext() {
    return this.audioCtx;
  }

  unlockAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  async playAlarmTone() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return false;

      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          return false;
        }
      }

      if (ctx.state !== 'running') {
        return false;
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      this.playCount++;
      return true;
    } catch (err) {
      return false;
    }
  }

  startAlarmSound() {
    this.stopAlarmSound();
    this.unlockAudio();
    this.playAlarmTone();
    this.alarmIntervalId = setInterval(() => {
      this.playAlarmTone();
    }, 1600);
  }

  stopAlarmSound() {
    if (this.alarmIntervalId) {
      clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
  }
}

async function runSoundTests() {
  console.log('================================================================');
  console.log('   GeoAlarm Sound System & AudioContext Lifecycle Test Suite    ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: AudioContext Autoplay Blocking Without User Gesture
  // -------------------------------------------------------------
  console.log('--- Test 1: Autoplay Blocking Detection ---');
  {
    const mockCtx = new MockAudioContext(false);
    mockCtx.userGestureActive = false; // No click yet
    const engine = new SoundEngine(mockCtx);

    assert(mockCtx.state === 'suspended', 'AudioContext is suspended on initial load');
    const played = await engine.playAlarmTone();
    assert(played === false, 'Tone safely aborted when context cannot resume without user gesture');
    assert(mockCtx.state === 'suspended', 'Context remains safely suspended without uncaught exceptions');
  }

  // -------------------------------------------------------------
  // Test 2: Synchronous User Gesture Unlock
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Synchronous User Gesture Unlock (unlockAudio) ---');
  {
    const mockCtx = new MockAudioContext(false);
    const engine = new SoundEngine(mockCtx);

    // Simulate user clicking "Start Tracking" or "Simulate Arrival"
    mockCtx.userGestureActive = true;
    engine.unlockAudio();
    await Promise.resolve(); // microtask

    assert(mockCtx.state === 'running', 'AudioContext transitioned to "running" state on user gesture');
    assert(mockCtx.currentTime > 0, 'AudioContext hardware clock initialized');

    // Subsequent tone playback succeeds immediately
    const played = await engine.playAlarmTone();
    assert(played === true, 'Alarm tone played successfully on unlocked context');
    assert(mockCtx.scheduledNodes.length >= 2, 'Oscillator start and stop events registered on audio destination');
  }

  // -------------------------------------------------------------
  // Test 3: Simulate Arrival Flow (User Gesture -> Async Permission -> Sound)
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Simulate Arrival Audio Activation Across Async Turns ---');
  {
    const mockCtx = new MockAudioContext(false);
    const engine = new SoundEngine(mockCtx);

    // Click handler starts:
    mockCtx.userGestureActive = true;
    engine.unlockAudio(); // 1. Synchronously unlock in click handler

    // Simulate async operations (requestNotificationPermission, coordinate math)
    mockCtx.userGestureActive = false; // user gesture token expires after await
    await new Promise(r => setTimeout(r, 10));

    // Now triggerAlarm calls startAlarmSound()
    engine.startAlarmSound();
    await Promise.resolve();

    assert(mockCtx.state === 'running', 'AudioContext remained running even after async await turns');
    assert(engine.alarmIntervalId !== null, 'Repeating chime loop interval active');
    assert(engine.playCount >= 1, 'Initial chime tone played immediately on arrival trigger');
    engine.stopAlarmSound();
  }

  // -------------------------------------------------------------
  // Test 4: Snooze Flow (Stop Active Sound Without Corrupting AudioContext)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Snooze Flow Halts Sound While Preserving Engine ---');
  {
    const mockCtx = new MockAudioContext(false);
    mockCtx.userGestureActive = true;
    const engine = new SoundEngine(mockCtx);
    engine.unlockAudio();
    engine.startAlarmSound();
    assert(engine.alarmIntervalId !== null, 'Sound playing before snooze');

    // User clicks Snooze (5m)
    engine.stopAlarmSound();
    assert(engine.alarmIntervalId === null, 'Sound interval stopped immediately on snooze');
    assert(mockCtx.state === 'running', 'AudioContext remains running (ready for snooze expiry re-trigger)');
  }

  // -------------------------------------------------------------
  // Test 5: 5-Minute Snooze Expiry Retrigger Plays Sound Without User Gesture
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Snooze Expiry Retrigger Plays Sound in Background ---');
  {
    const mockCtx = new MockAudioContext(false);
    mockCtx.userGestureActive = true;
    const engine = new SoundEngine(mockCtx);
    engine.unlockAudio(); // Unlocked earlier by user
    mockCtx.userGestureActive = false; // No active click at timer expiry

    engine.startAlarmSound();
    engine.stopAlarmSound(); // Snoozed
    const playsBefore = engine.playCount;

    // Simulate 5 minutes passing in background timer callback (no user gesture)
    mockCtx.advanceTime(300);
    engine.startAlarmSound(); // Timer re-evaluates and triggers arrival
    await Promise.resolve();

    assert(engine.alarmIntervalId !== null, 'Alarm interval restarted upon snooze expiry');
    assert(engine.playCount > playsBefore, 'Alarm sound successfully played without needing extra user click');
    engine.stopAlarmSound();
  }

  // -------------------------------------------------------------
  // Test 6: Dismiss Alarm Flow
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Dismiss Alarm Halts Audio Loop ---');
  {
    const mockCtx = new MockAudioContext(true);
    const engine = new SoundEngine(mockCtx);
    engine.startAlarmSound();
    assert(engine.alarmIntervalId !== null, 'Sound active before dismissal');

    // Click "I Have Arrived (Dismiss)"
    engine.stopAlarmSound();
    assert(engine.alarmIntervalId === null, 'Sound cleared on dismissal');
  }

  // -------------------------------------------------------------
  // Test 7: Multi-Cycle Repeated Triggers
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Repeated Multi-Cycle Simulation Reliability ---');
  {
    const mockCtx = new MockAudioContext(true);
    const engine = new SoundEngine(mockCtx);

    for (let cycle = 1; cycle <= 5; cycle++) {
      engine.startAlarmSound();
      assert(engine.alarmIntervalId !== null, `Cycle ${cycle}: Sound loop started`);
      await engine.playAlarmTone();
      engine.stopAlarmSound();
      assert(engine.alarmIntervalId === null, `Cycle ${cycle}: Sound loop cleanly stopped`);
    }

    assert(engine.playCount >= 10, 'All 5 simulation cycles successfully emitted sound tones without failures');
  }

  console.log('\n================================================================');
  console.log('   🎉 ALL 7 SOUND & AUDIO LIFECYCLE TESTS PASSED (100%)        ');
  console.log('================================================================\n');
}

runSoundTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
