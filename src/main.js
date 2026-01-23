// ===========================================================
// Modern Electron Main Process
// ===========================================================
const { app, BrowserWindow, ipcMain } = require("electron");
// const SerialPort = require("serialport");
const { SerialPort } = require('serialport');
// const { list } = SerialPort;
// const list = require("@serialport/list");

// const { ipcMain } = require('electron');
// const { SerialPort } = require('serialport');  // modern import


const path = require("path");
const fs = require("fs");
const aedes = require('aedes')();
const net = require('net');
const ws = require('ws');
const http = require('http');

let mainWindow = null;
const latestMQTT = new Map();
let mqttFlushScheduled = false;



// ===========================================================
// DEVELOPMENT AUTO-RELOAD
// ===========================================================
if (process.env.NODE_ENV === "autoreload") {
  try {
    require("electron-reload")(__dirname, {
      electron: path.join(__dirname, "..", "node_modules", ".bin", "electron")
    });
    console.log("Auto-reload enabled.");
  } catch (e) {
    console.warn("[WARN] electron-reload not installed.");
  }
} else {
  console.log("Auto-reload disabled.");
}

// ===========================================================
// STATE VARIABLES
// ===========================================================
let camState = 0;
let leftLight = 0;
let rightLight = 0;
let rearLight = 0;
let btn1Color = [];
let btn2Color = [];
let btn3Color = [];

let espPort = null;
let writeQueue = [];
let isWriting = false;

// ===========================================================
// SERIAL PORT UTILS
// ===========================================================
function ensurePortOpen() {
  return new Promise((resolve, reject) => {
    if (!espPort) return reject("Port not initialized.");
    if (espPort.isOpen) return resolve();
    espPort.open(err => (err ? reject(err) : resolve()));
  });
}

async function processQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;

  while (writeQueue.length > 0) {
    const { data, resolve, reject } = writeQueue.shift();
    try {
      await ensurePortOpen();
      await new Promise((res, rej) =>
        espPort.write(Buffer.from(data), err => (err ? rej(err) : res()))
      );
      resolve(true);
    } catch (err) {
      reject(err);
    }
  }

  isWriting = false;
}

// ===========================================================
// IPC HANDLERS (REGISTER BEFORE WINDOW CREATION)
// ===========================================================



ipcMain.handle("load-kph-json", () => {
    const filePath = path.join(app.getAppPath(), "kph.json");
    const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return jsonData;
});

// UI events
ipcMain.on("puttonPress", (event, data) => {
  console.log("[UI EVENT]", data);

  if (data === "cam") camState ^= 1;
  if (data === "leftOn") leftLight = 1;
  if (data === "leftOff") leftLight = 0;
  if (data === "rearOn") rearLight = 1;
  if (data === "rearOff") rearLight = 0;

  if (typeof data === "object" && data.rightLight !== undefined)
    rightLight = data.rightLight;

  if (typeof data === "object" && data.btn1Color) btn1Color = data.btn1Color;
  if (typeof data === "object" && data.btn2Color) btn2Color = data.btn2Color;
  if (typeof data === "object" && data.btn3Color) btn3Color = data.btn3Color;

  const filePath = path.join(app.getAppPath(), "kph.json");
  let jsonData = {};
  try { jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch {}

  jsonData.kamera = camState;
  jsonData.leftLight = leftLight;
  jsonData.rightLight = rightLight;
  jsonData.rearLight = rearLight;
  if (btn1Color.length) jsonData.btn1Color = btn1Color;
  if (btn2Color.length) jsonData.btn2Color = btn2Color;
  if (btn3Color.length) jsonData.btn3Color = btn3Color;

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
});

// ---------------------------------------
// Serial Port State
// ---------------------------------------
// let espPort = null;
// let writeQueue = [];
// let isWriting = false;


// ---------------------------------------
// Ensure port open
// ---------------------------------------
function ensurePortOpen() {
    return new Promise((resolve, reject) => {
        if (!espPort) return reject("Port not initialized");

        if (espPort.isOpen) return resolve();

        espPort.open(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}


// ---------------------------------------
// Queue processor
// ---------------------------------------
async function processQueue() {
    if (isWriting) return;
    if (writeQueue.length === 0) return;

    isWriting = true;

    while (writeQueue.length > 0) {
        const { data, resolve, reject } = writeQueue.shift();

        try {
            await ensurePortOpen();

            await new Promise((res, rej) => {
                espPort.write(Buffer.from(data), err => {
                    if (err) rej(err);
                    else res();
                });
            });

            resolve(true);
        } catch (err) {
            reject(err);
        }
    }

    isWriting = false;
}


// ---------------------------------------
// IPC: Serial Write (Queued)
// ---------------------------------------
ipcMain.handle("serialWrite", async (event, byteArray) => {
    return new Promise((resolve, reject) => {
        writeQueue.push({ data: byteArray, resolve, reject });
        processQueue();
    });
});


// ---------------------------------------
// List Ports
// ---------------------------------------
ipcMain.handle("listSerialPorts", async () => {
    const ports = await SerialPort.list();
    return ports.filter(p => (
        p.vendorId?.toLowerCase() === '10c4' ||   // Silicon Labs
        p.vendorId?.toLowerCase() === '1a86' ||   // CH340
        p.manufacturer?.toLowerCase().includes("silicon labs") ||
        p.manufacturer?.toLowerCase().includes("esp")
    ));
});


// ---------------------------------------
// Open Port  <-- FIXED HERE
// ---------------------------------------
ipcMain.handle("serialOpen", async (event, portPath) => {

    console.log("serialOpen called with:", portPath);

    // If already open
    if (espPort && espPort.isOpen) return true;

    // If exists but closed
    if (espPort && !espPort.isOpen) {
        try { await new Promise(resolve => espPort.close(resolve)); } catch {}
        espPort = null;
    }

    // ⚠ FIXED: Correct SerialPort constructor
    espPort = new SerialPort({
        path: portPath,
        baudRate: 115200,
        autoOpen: false,
        lock: false
    });

    // Data listener
    espPort.on("data", data => {
        event.sender.send("serialData", data.toString("utf8").trim());
    });

    espPort.on("error", err => {
        console.error("[Serial Error]", err);
    });

    // Open the port
    return new Promise((resolve, reject) => {
        espPort.open(err => {
            if (err) reject(err);
            else resolve(true);
        });
    });
});


// ---------------------------------------
// Close Port
// ---------------------------------------
ipcMain.handle("serialClose", async () => {
    if (!espPort) return false;

    return new Promise(resolve => {
        espPort.close(() => {
            espPort = null;
            writeQueue = [];
            isWriting = false;
            resolve(true);
        });
    });
});







// ===========================================================
// CREATE WINDOW
// ===========================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: "#112",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.openDevTools();

  return mainWindow;
}


// ===========================================================
// APP READY
// ===========================================================
// const { app, BrowserWindow, ipcMain } = require("electron");
// const net = require('net');
// const ws = require('ws');
// const http = require('http');
// const aedes = require('aedes')();

const MQTT_PORT = 1883;
const WS_PORT = 8884;

function startMQTTBroker() {
  // TCP server
  const tcpServer = net.createServer(aedes.handle);
  tcpServer.listen(MQTT_PORT, '0.0.0.0', () => {
    console.log('MQTT TCP server listening on port', MQTT_PORT);
  });

  // WebSocket server
  const httpServer = http.createServer();
  const wss = new ws.Server({ server: httpServer });

  wss.on('connection', (wsClient) => {
    const stream = ws.createWebSocketStream(wsClient);
    aedes.handle(stream);
  });

  httpServer.listen(WS_PORT, '0.0.0.0', () => {
    console.log('MQTT WS server listening on port', WS_PORT);
  });

  // Logging
  aedes.on('client', (client) => console.log('[CONNECT]', client.id));
  aedes.on('clientDisconnect', (client) => console.log('[DISCONNECT]', client.id));
  // aedes.on('publish', (packet, client) => {
  //   if (!client) return; // internal
  //   console.log(`[MSG] ${client.id} | ${packet.topic} | ${packet.payload.toString()}`);
  // });

// aedes.on('publish', (packet, client) => {
//   if (!client || !mainWindow) return;
//   if (packet.topic.startsWith("$SYS")) return;

//   //  Ignore WebSocket-originated publishes (UI)
//   if (client.conn?.remotePort === WS_PORT) return;

//   setImmediate(() => {
//     if (mainWindow?.isDestroyed()) return;

//     mainWindow.webContents.send("mqttMessage", {
//       topic: packet.topic,
//       payload: packet.payload.toString()
//     });
//   });
// });

// aedes.on('publish', (packet, client) => {
//   if (!client || !mainWindow) return;
//   if (packet.topic.startsWith("$SYS")) return;

//   // Store only latest value
//   latestMQTT.set(packet.topic, packet.payload.toString());

//   // Schedule ONE flush per tick
//   if (!mqttFlushScheduled) {
//     mqttFlushScheduled = true;

//     setImmediate(() => {
//       mqttFlushScheduled = false;

//       if (!mainWindow || mainWindow.isDestroyed()) return;

//       // Send ALL latest values at once
//       mainWindow.webContents.send("mqttBatch", Array.from(latestMQTT.entries()));

//       // Clear after sending
//       latestMQTT.clear();
//     });
//   }
// });

function processMqttQueue() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mqttQueue.clear();
    mqttWorkerRunning = false;
    return;
  }

  if (mqttQueue.size === 0) {
    mqttWorkerRunning = false;
    return;
  }

  // Drain snapshot
  const batch = Array.from(mqttQueue.entries());
  mqttQueue.clear();

  try {
    mainWindow.webContents.send('mqttBatch', batch);
  } catch (err) {
    console.error('[IPC SEND ERROR]', err);
  }

  // Yield back to event loop before next batch
  setTimeout(processMqttQueue, 16); // ~60 Hz max
}



const mqttQueue = new Map(); // topic -> payload
let mqttWorkerRunning = false;

aedes.on('publish', (packet, client) => {
  if (!client) return;
  if (packet.topic.startsWith('$SYS')) return;

  // 🔒 ABSOLUTE LOOP GUARD
  if (client.id === 'electron-ui') return;
  if (client.id === 'serial-bridge') return;

  // Store only latest per topic
  mqttQueue.set(packet.topic, packet.payload.toString());

  // Start worker if not running
  if (!mqttWorkerRunning) {
    mqttWorkerRunning = true;
    setImmediate(processMqttQueue);
  }
});




  aedes.on('clientError', (client, err) => console.log('[CLIENT ERROR]', client.id, err.message));
  aedes.on('connectionError', (client, err) => console.log('[CONNECTION ERROR]', err.message));
}

// Electron ready
app.whenReady().then(() => {
  console.log('Electron ready — starting MQTT broker');
  startMQTTBroker();
createWindow();
  // const win = new BrowserWindow({
  //   width: 1920,
  //   height: 1080,
  //   webPreferences: {
  //     preload: path.join(__dirname, "preload.js"),
  //     contextIsolation: true
  //   }
  // });
  // macOS: re-create window on activate 
  app.on('activate', () => { 
    if (BrowserWindow.getAllWindows().length === 0) 
      createWindow(); });
  // win.loadFile("index.html");
});


// Quit when all windows closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});







// ===========================
// CONFIG
// ===========================
// const MQTT_PORT = 1883;
// const WS_PORT = 8884;

// ===========================
// MQTT TCP SERVER
// ===========================
// const tcpServer = net.createServer(aedes.handle);

// tcpServer.listen(MQTT_PORT, '0.0.0.0', () => {
//   console.log('MQTT TCP server listening on port', MQTT_PORT);
// });

// // ===========================
// // MQTT WEBSOCKET SERVER
// // ===========================
// const httpServer = http.createServer();
// const wss = new ws.Server({ server: httpServer });

// wss.on('connection', (wsClient) => {
//   const stream = ws.createWebSocketStream(wsClient);
//   aedes.handle(stream);
// });

// httpServer.listen(WS_PORT, '0.0.0.0', () => {
//   console.log('MQTT WS server listening on port', WS_PORT);
// });

// // ===========================
// // MQTT LOGGING
// // ===========================
// aedes.on('client', (client) => {
//   console.log('[CONNECT]', client.id);
// });

// aedes.on('clientDisconnect', (client) => {
//   console.log('[DISCONNECT]', client.id);
// });

// aedes.on('publish', (packet, client) => {
//   if (!client) return; // ignore broker internal messages

//   console.log(
//     `[MSG] ${client.id} | ${packet.topic} | ${packet.payload.toString()}`
//   );
// });

// // ===========================
// // ELECTRON LIFECYCLE
// // ===========================
// app.whenReady().then(() => {
//   console.log('Electron MQTT broker ready');
// });

// app.on('window-all-closed', () => {
//   // Keep process alive even without windows
// });











// ===========================================================
// MQTT SERVER
// ===========================================================
// const MQTT_PORT = 1883;
// const WS_PORT = 8884;

// // TCP
// const server = net.createServer(aedes.handle);
// server.listen(MQTT_PORT, () => console.log('MQTT TCP server on', MQTT_PORT));

// // WebSocket
// const httpServer = http.createServer();
// const wss = new ws.Server({ server: httpServer });

// wss.on('connection', wsClient => {
//   const stream = ws.createWebSocketStream(wsClient);
//   aedes.handle(stream);
// });

// httpServer.listen(WS_PORT, () => console.log('MQTT WS server on', WS_PORT));

// // Log client events
// aedes.on('client', client => console.log('Client connected:', client.id));
// aedes.on('clientDisconnect', client => console.log('Client disconnected:', client.id));
// aedes.on('publish', (packet, client) => {
//   if (client) console.log(`Message from ${client.id}: ${packet.topic} -> ${packet.payload.toString()}`);
// });
