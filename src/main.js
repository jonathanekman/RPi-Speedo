// ===========================================================
// Modern Electron Main Process
// ===========================================================
const { app, BrowserWindow, ipcMain, session } = require("electron");
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
const os = require('os');
const QRCode = require('qrcode');

let mainWindow = null;
let roofQrDataUrl = null;
const latestMQTT = new Map();
let mqttFlushScheduled = false;

// ===========================================================
// GPS SERIAL READER (Prolific USB-to-Serial)
// ===========================================================
const GPS_VID = '067B';
const GPS_PID = '2303';
let gpsPort = null;
let gpsBuffer = '';
let gpsData = { speed: null, time: null, altitude: null, satellites: null };

function startGPS() {
  SerialPort.list().then(ports => {
    const gpsDevice = ports.find(p =>
      p.vendorId?.toUpperCase() === GPS_VID &&
      p.productId?.toUpperCase() === GPS_PID
    );

    if (!gpsDevice) {
      // console.warn('[GPS] Device not found (VID:067B PID:2303). Retrying in 5s...');
      sendGPSStatus(false);
      setTimeout(startGPS, 5000);
      return;
    }

    console.log('[GPS] Found device on', gpsDevice.path);
    sendGPSStatus(true);

    gpsPort = new SerialPort({
      path: gpsDevice.path,
      baudRate: 4800,
      autoOpen: true,
      lock: false
    });

    gpsPort.on('data', chunk => {
      gpsBuffer += chunk.toString('utf8');
      let lines = gpsBuffer.split('\n');
      gpsBuffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        parseNMEA(line.trim());
      }
    });

    gpsPort.on('error', err => {
      console.error('[GPS] Serial error:', err.message);
      sendGPSStatus(false);
    });

    gpsPort.on('close', () => {
      console.warn('[GPS] Port closed. Reconnecting in 5s...');
      gpsPort = null;
      sendGPSStatus(false);
      setTimeout(startGPS, 5000);
    });
  }).catch(err => {
    console.error('[GPS] Error listing ports:', err.message);
    setTimeout(startGPS, 5000);
  });
}

function formatTimeGMT1(t) {
  if (!t || t.length < 6) return null;
  const h = (parseInt(t.substring(0, 2), 10) + 1) % 24;
  const m = parseInt(t.substring(2, 4), 10);
  const s = parseInt(t.substring(4, 6), 10);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseNMEA(line) {
  const parts = line.split(',');
  if (!parts.length) return;

  // GGA - altitude + satellites
  if (parts[0].endsWith('GGA')) {
    if (parts.length > 9) {
      if (parts[7]) gpsData.satellites = parts[7];
      if (parts[9]) gpsData.altitude = Math.round(parseFloat(parts[9]) * 10) / 10;
    }
  }

  // RMC - speed + time
  if (parts[0].endsWith('RMC')) {
    if (parts.length > 7 && parts[2] === 'A') {
      gpsData.time = formatTimeGMT1(parts[1]);
      const knots = parseFloat(parts[7]);
      gpsData.speed = Math.round(knots * 1.852 * 100) / 100; // knots to km/h

      sendGPSToRenderer();
    }
  }
}

function sendGPSToRenderer() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gpsData', gpsData);
  }
}

function sendGPSStatus(connected) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gpsStatus', connected);
  }
}



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
ipcMain.on("quit-app", () => {
  app.quit();
});

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
    fullscreen: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  // mainWindow.webContents.openDevTools();

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
const HELLO_PORT = 8080;

const ROOF_TARGETS = { left: 'leftLightSlider', center: 'centerLightSlider', right: 'rightLightSlider' };
const SLIDER_TO_TARGET = { leftLightSlider: 'left', centerLightSlider: 'center', rightLightSlider: 'right' };
const roofValues = { left: 0, center: 0, right: 0 };
const sseClients = new Set();

function broadcastRoof(target, value) {
  const payload = `event: roof\ndata: ${JSON.stringify({ target, value })}\n\n`;
  for (const c of sseClients) {
    try { c.write(payload); } catch {}
  }
}

const mjpegClients = new Set();
let latestFrame = null;
let cameraActive = false;

function setCameraActive(active) {
  if (cameraActive === active) return;
  cameraActive = active;
  console.log(`[CAM] setCameraActive(${active}) mainWindow=${!!mainWindow}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cameraActive', active);
  }
  if (!active) { latestFrame = null; frameCount = 0; }
}

function pushFrame(buf) {
  const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`;
  for (const c of mjpegClients) {
    try { c.write(header); c.write(buf); c.write('\r\n'); } catch {}
  }
}

let frameCount = 0;
ipcMain.on('cameraFrame', (_e, buf) => {
  if (!buf) return;
  latestFrame = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  frameCount++;
  if (frameCount === 1 || frameCount % 50 === 0) {
    console.log(`[CAM] frame #${frameCount} bytes=${latestFrame.length} clients=${mjpegClients.size}`);
  }
  pushFrame(latestFrame);
});

ipcMain.on('roofSliderUpdate', (_e, { sliderId, value }) => {
  const target = SLIDER_TO_TARGET[sliderId];
  if (!target) return;
  const v = Math.max(0, Math.min(100, Number(value)));
  if (Number.isNaN(v) || roofValues[target] === v) return;
  roofValues[target] = v;
  broadcastRoof(target, v);
});

const HELLO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#000000">
<title>Roof Lights</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
  body{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:2.5rem 1.25rem}
  h1{margin:0 0 2rem;font-size:1.1rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
  .list{width:100%;max-width:420px;border-top:1px solid #000}
  label{display:flex;align-items:center;gap:1rem;padding:1.25rem .25rem;border-bottom:1px solid #000;cursor:pointer;user-select:none;font-size:1rem}
  input[type=checkbox]{appearance:none;-webkit-appearance:none;width:1.4rem;height:1.4rem;border:1px solid #000;background:#fff;margin:0;cursor:pointer;flex-shrink:0;position:relative}
  input[type=checkbox]:checked{background:#000}
  input[type=checkbox]:checked::after{content:"";position:absolute;left:.38rem;top:.1rem;width:.4rem;height:.8rem;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
  .name{flex:1}
  .state{font-variant-numeric:tabular-nums;opacity:.5;font-size:.9rem}
  #camBtn{width:100%;max-width:420px;margin-top:1.5rem;padding:1rem;background:#fff;color:#000;border:1px solid #000;font:inherit;font-size:1rem;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.6rem}
  #camBtn:active{background:#000;color:#fff}
  #camBtn svg{width:1.2rem;height:1.2rem;fill:currentColor}
  #camView{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;background:#000;display:none;align-items:center;justify-content:center;z-index:9999;cursor:pointer;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
  #camView.open{display:flex}
  #camView img{max-width:100%;max-height:100%;width:auto;height:auto;display:block;object-fit:contain}
  html.camOpen,body.camOpen{overflow:hidden;overscroll-behavior:none}
</style>
</head>
<body>
<h1>Roof Lights</h1>
<div class="list">
  <label><input type="checkbox" data-target="left"><span class="name">Left</span><span class="state" id="state-left">0%</span></label>
  <label><input type="checkbox" data-target="center"><span class="name">Center</span><span class="state" id="state-center">0%</span></label>
  <label><input type="checkbox" data-target="right"><span class="name">Right</span><span class="state" id="state-right">0%</span></label>
</div>
<button id="camBtn"><svg viewBox="0 0 24 24"><path d="M9 4l-2 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>Camera</button>
<div id="camView"><img id="camImg" alt=""></div>
<script>
  document.querySelectorAll('input[type=checkbox][data-target]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const target=cb.dataset.target;
      const value=cb.checked?100:0;
      document.getElementById('state-'+target).textContent=value+'%';
      fetch('/roof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,value})}).catch(()=>{});
    });
  });
  function applyRoof(target,value){
    const cb=document.querySelector('input[data-target="'+target+'"]');
    const stateEl=document.getElementById('state-'+target);
    if(cb)cb.checked=value>0;
    if(stateEl)stateEl.textContent=value+'%';
  }
  function connectEvents(){
    const es=new EventSource('/events');
    es.addEventListener('roof',e=>{try{const{target,value}=JSON.parse(e.data);applyRoof(target,value);}catch{}});
    es.onerror=()=>{es.close();setTimeout(connectEvents,2000);};
  }
  connectEvents();
  const camBtn=document.getElementById('camBtn');
  const camView=document.getElementById('camView');
  const camImg=document.getElementById('camImg');
  function openCam(){
    camImg.src='/stream.mjpg?t='+Date.now();
    camView.classList.add('open');
    document.documentElement.classList.add('camOpen');
    document.body.classList.add('camOpen');
    const el=camView;
    const req=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen;
    if(req){try{Promise.resolve(req.call(el)).catch(()=>{});}catch{}}
    if(screen.orientation&&screen.orientation.lock){screen.orientation.lock('landscape').catch(()=>{});}
    setTimeout(()=>window.scrollTo(0,1),50);
  }
  function closeCam(){
    camView.classList.remove('open');
    document.documentElement.classList.remove('camOpen');
    document.body.classList.remove('camOpen');
    camImg.removeAttribute('src');
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(exit&&document.fullscreenElement){try{exit.call(document);}catch{}}
  }
  camBtn.addEventListener('click',openCam);
  camView.addEventListener('click',closeCam);
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&camView.classList.contains('open'))closeCam();});
</script>
</body>
</html>`;

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

let lastRoofIp = null;

async function refreshRoofQr() {
  const ip = getLanIp();
  if (ip === lastRoofIp && roofQrDataUrl) return;
  lastRoofIp = ip;
  const url = `http://${ip}:${HELLO_PORT}`;
  try {
    roofQrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#000', light: '#fff' } });
    console.log('[QR] Roof control URL:', url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('roofQr', roofQrDataUrl);
    }
  } catch (err) {
    console.error('[QR] Failed to generate:', err.message);
  }
}

ipcMain.handle('getRoofQr', () => roofQrDataUrl);

function startHelloServer() {
  const server = http.createServer((req, res) => {
    console.log(`[HTTP] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    const pathOnly = (req.url || '').split('?')[0];
    if (req.method === 'GET' && pathOnly === '/stream.mjpg') {
      res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, private',
        'Pragma': 'no-cache',
        'Connection': 'close'
      });
      mjpegClients.add(res);
      setCameraActive(true);
      if (latestFrame) {
        try {
          res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestFrame.length}\r\n\r\n`);
          res.write(latestFrame);
          res.write('\r\n');
        } catch {}
      }
      const cleanup = () => {
        mjpegClients.delete(res);
        if (mjpegClients.size === 0) setCameraActive(false);
      };
      req.on('close', cleanup);
      req.on('error', cleanup);
      return;
    }
    if (req.method === 'GET' && pathOnly === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(': connected\n\n');
      sseClients.add(res);
      for (const [t, v] of Object.entries(roofValues)) {
        res.write(`event: roof\ndata: ${JSON.stringify({ target: t, value: v })}\n\n`);
      }
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 15000);
      req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
      return;
    }
    if (req.method === 'POST' && pathOnly === '/roof') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        try {
          const { target, value } = JSON.parse(body);
          const sliderId = ROOF_TARGETS[target];
          const v = Math.max(0, Math.min(100, Number(value)));
          if (!sliderId || Number.isNaN(v)) { res.writeHead(400); return res.end(); }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('roofSlider', { sliderId, value: v });
          }
          res.writeHead(204); res.end();
        } catch { res.writeHead(400); res.end(); }
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    res.end(HELLO_HTML);
  });
  server.listen(HELLO_PORT, '0.0.0.0', () => {
    console.log(`Hello server listening on http://localhost:${HELLO_PORT}`);
  });
}

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
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(false);
  });
  startMQTTBroker();
  startHelloServer();
  refreshRoofQr();
  setInterval(refreshRoofQr, 5000);
  startGPS();
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
