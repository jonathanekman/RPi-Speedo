// ===========================================================
// picoNet.js — manage the wired link to the controllerBox Pico
// ===========================================================
// The Pico is wired point-to-point and dials the MQTT broker at a hardcoded
// 192.168.2.1 (see the Pico firmware). This module gives the wired NIC that
// address on app launch and restores whatever was there before on quit — all
// via nmcli, so no root/sudo is needed (the user's session already has the
// NetworkManager polkit rights). Works with any wired NIC name (enx… on the
// dev PC, eth0 on the target RPi 4).

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { app } = require('electron');

const execFileAsync = promisify(execFile);

const LINK_CIDR = '192.168.2.1/24';   // must match the Pico firmware `server`
const PROFILE = 'pico-link';          // app-owned NetworkManager profile
const STATE_FILE = path.join(app.getPath('userData'), 'pico-link-restore.json');

// Watcher tuning. See startPicoLinkWatch().
const WATCH_INTERVAL_MS = 3000;
const WATCH_BACKOFF_MS = 15000;
const WATCH_FAILS_BEFORE_BACKOFF = 3;

// The interface setupPicoLink() settled on, so the watcher re-takes the same one.
let currentIface = null;

function nmcli(args) {
  return execFileAsync('nmcli', args);
}

// Is a cable actually attached? nmcli's "connected" state is unreliable — a
// profile can be active on a cable-less NIC — so key off the kernel carrier
// flag. Reading carrier on a down interface throws (EINVAL) = "no link".
function hasCarrier(dev) {
  try {
    return fs.readFileSync(`/sys/class/net/${dev}/carrier`, 'utf8').trim() === '1';
  } catch {
    return false;
  }
}

// Detect the wired interface to use. Override with PICO_IFACE if needed.
async function detectWiredIface() {
  if (process.env.PICO_IFACE) return process.env.PICO_IFACE;

  const { stdout } = await nmcli(['-t', '-f', 'DEVICE,TYPE', 'device']);
  const eths = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => line.split(':')) // DEVICE names never contain ':'
    .filter(([device, type]) => type === 'ethernet' &&
                                !/^(lo|docker|veth|br-)/.test(device))
    .map(([device]) => device);

  // Prefer an interface with a live physical link (cable actually attached).
  return eths.find(hasCarrier) || eths[0] || null;
}

async function activeConnectionOn(iface) {
  const { stdout } = await nmcli(['-g', 'GENERAL.CONNECTION', 'device', 'show', iface]);
  return stdout.trim(); // '' when the device has no active connection
}

async function profileExists(name) {
  const { stdout } = await nmcli(['-g', 'NAME', 'con', 'show']);
  return stdout.split('\n').map(s => s.trim()).includes(name);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (err) {
    console.error('[picoNet] could not persist restore state', err.message);
  }
}

// Create/repoint the app-owned profile and bring it up on `iface`. Safe to call
// repeatedly — this is exactly what re-takes the NIC after NetworkManager has
// autoconnected some other profile to it. The `con mod` step is kept so a
// re-enumerated USB NIC (new enx… name) rebinds the profile to the new device.
async function ensurePicoLinkUp(iface) {
  if (await profileExists(PROFILE)) {
    await nmcli(['con', 'mod', PROFILE,
      'ipv4.addresses', LINK_CIDR,
      'connection.interface-name', iface]);
  } else {
    await nmcli(['con', 'add', 'type', 'ethernet',
      'ifname', iface,
      'con-name', PROFILE,
      'ipv4.method', 'manual',
      'ipv4.addresses', LINK_CIDR,
      'ipv4.never-default', 'yes',
      'autoconnect', 'no']);
  }
  await nmcli(['con', 'up', PROFILE]);
}

// Called on app launch: give the wired NIC 192.168.2.1/24 for the Pico.
async function setupPicoLink() {
  try {
    const iface = await detectWiredIface();
    if (!iface) {
      console.warn('[picoNet] no wired interface found — skipping Pico link setup');
      return;
    }
    currentIface = iface;

    // Capture the connection that was active before we take over, so we can
    // restore it on quit. Never record our own profile as the "original", and
    // don't clobber a previously saved original on a crash-relaunch.
    const original = await activeConnectionOn(iface);
    if (original && original !== PROFILE) {
      writeState({ iface, originalConnection: original });
    }

    await ensurePicoLinkUp(iface);
    console.log(`[picoNet] ${PROFILE} up on ${iface} (${LINK_CIDR})`);
  } catch (err) {
    console.error('[picoNet] setup failed', err.message);
  }
}

// ----------------------------------------------------------------------
// Link watcher
// ----------------------------------------------------------------------
// The pico-link profile is deliberately `autoconnect no` so the NIC is released
// cleanly when the app quits. The cost is that NetworkManager drops it when the
// cable is unplugged, and on replug it autoconnects whatever profile *does*
// have autoconnect (on the dev PC: "Profile 1", which hands the NIC a
// 192.168.1.x address). 192.168.2.1 then no longer exists on the wire, the Pico
// ARPs for a host that isn't there, and it can never reconnect — until the app
// is restarted. Hence: watch the link and re-take the NIC ourselves.
//
// Polling rather than `nmcli monitor`: sysfs `carrier` does not reliably emit
// inotify events, and a long-lived child process is more to unwind on quit. The
// cost is one cheap file read every few seconds, with an nmcli call only when
// the carrier is actually up.

let watchTimer = null;
let watchStopped = false;
let watchBusy = false;
let watchFails = 0;
let lastCarrier = null;   // null = unknown, so the first tick logs nothing

function scheduleWatch(delay) {
  if (watchStopped) return;
  watchTimer = setTimeout(watchTick, delay);
  if (typeof watchTimer.unref === 'function') watchTimer.unref();
}

async function watchTick() {
  if (watchStopped) return;
  if (watchBusy) return scheduleWatch(WATCH_INTERVAL_MS);
  watchBusy = true;

  try {
    // The NIC can vanish entirely (USB dock unplugged) or come back under a
    // different name, so re-detect when our cached one is gone.
    if (!currentIface || !fs.existsSync(`/sys/class/net/${currentIface}`)) {
      currentIface = await detectWiredIface();
    }

    if (!currentIface) {
      lastCarrier = false;
    } else {
      const up = hasCarrier(currentIface);

      if (lastCarrier === true && !up) {
        console.log(`[picoNet] link down on ${currentIface} — waiting for cable`);
      }

      if (up) {
        const active = await activeConnectionOn(currentIface);
        if (active !== PROFILE) {
          console.log(`[picoNet] ${currentIface} is on "${active || 'nothing'}" — re-applying ${PROFILE}`);
          await ensurePicoLinkUp(currentIface);
          console.log(`[picoNet] ${PROFILE} restored on ${currentIface} (${LINK_CIDR})`);
        }
      }
      lastCarrier = up;
    }
    watchFails = 0;
  } catch (err) {
    watchFails++;
    // Only log the first couple, then go quiet — a permanently broken nmcli
    // should not fill the console.
    if (watchFails <= WATCH_FAILS_BEFORE_BACKOFF) {
      console.error('[picoNet] watch failed', err.message);
    }
  } finally {
    watchBusy = false;
    // Back off if nmcli keeps failing so we cannot spin against NetworkManager.
    scheduleWatch(watchFails >= WATCH_FAILS_BEFORE_BACKOFF
      ? WATCH_BACKOFF_MS
      : WATCH_INTERVAL_MS);
  }
}

// Start watching. Call after setupPicoLink() has settled on an interface.
function startPicoLinkWatch() {
  if (watchTimer || watchStopped) return;
  console.log(`[picoNet] watching ${currentIface || 'wired link'} for cable changes`);
  scheduleWatch(WATCH_INTERVAL_MS);
}

// Stop watching. MUST be called before restorePicoLink(), or the watcher would
// race the restore and immediately re-take the NIC it just released.
function stopPicoLinkWatch() {
  watchStopped = true;
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = null;
  }
}

// Called on quit: restore whatever connection was active before launch.
async function restorePicoLink() {
  try {
    const state = readState();
    if (state?.originalConnection && state.originalConnection !== PROFILE) {
      await nmcli(['con', 'up', state.originalConnection]);
      console.log(`[picoNet] restored ${state.originalConnection}`);
    } else if (state?.iface) {
      // Unknown original — let NetworkManager auto-pick so the NIC isn't stranded.
      await nmcli(['device', 'connect', state.iface]);
      console.log(`[picoNet] reconnected ${state.iface} (auto)`);
    }
  } catch (err) {
    console.error('[picoNet] restore failed', err.message);
  }
}

module.exports = {
  setupPicoLink,
  restorePicoLink,
  startPicoLinkWatch,
  stopPicoLinkWatch,
};
