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

function nmcli(args) {
  return execFileAsync('nmcli', args);
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
  // nmcli's "connected" state is unreliable — a profile can be active on a
  // cable-less NIC — so key off the kernel carrier flag. Reading carrier on a
  // down interface throws (EINVAL), which we treat as "no link".
  const hasCarrier = (dev) => {
    try {
      return fs.readFileSync(`/sys/class/net/${dev}/carrier`, 'utf8').trim() === '1';
    } catch {
      return false;
    }
  };
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

// Called on app launch: give the wired NIC 192.168.2.1/24 for the Pico.
async function setupPicoLink() {
  try {
    const iface = await detectWiredIface();
    if (!iface) {
      console.warn('[picoNet] no wired interface found — skipping Pico link setup');
      return;
    }

    // Capture the connection that was active before we take over, so we can
    // restore it on quit. Never record our own profile as the "original", and
    // don't clobber a previously saved original on a crash-relaunch.
    const original = await activeConnectionOn(iface);
    if (original && original !== PROFILE) {
      writeState({ iface, originalConnection: original });
    }

    // Ensure the app-owned profile exists and points at the detected interface.
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
    console.log(`[picoNet] ${PROFILE} up on ${iface} (${LINK_CIDR})`);
  } catch (err) {
    console.error('[picoNet] setup failed', err.message);
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

module.exports = { setupPicoLink, restorePicoLink };
