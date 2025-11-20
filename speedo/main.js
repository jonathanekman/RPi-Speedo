const electron = require('electron');                                 //Auto reload window when debugging
const path = require('path');                                         //Auto reload window when debugging
require('electron-reload')(__dirname + '/app/index.html', {           //Auto reload window when debugging
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')  //Auto reload window when debugging
});              

var fs = require('fs');//Auto reload window when debugging

const {
  app,
  BrowserWindow,
  ipcMain
} = require("electron/main");

//const path = require('node:path')

// const { app, BrowserWindow } = require("electron");
const { Console } = require('console');
// const url = require("url");

app.$ = app.jQuery = require("./jquery-3.5.1.min.js");

function newApp() {
  // win = new BrowserWindow({backgroundColor: "#112", width : 1024, height : 600, frame: false, x: 0, y: 0});       //<- removes border
  // win = new BrowserWindow({ backgroundColor: "#112", width : 1024, height : 600, x: 900, y: 0});
  win = new BrowserWindow({ backgroundColor: "#112", width : 720, height : 751, x: 900, y: 0,
  webPreferences: {
    nodeIntegration: true, // <--- flag
    // nodeIntegrationInWorker: true, // <---  for web workers
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true
  }
}); //<-- X1 half right screen

  win.removeMenu()
  win.loadFile('index.html');
  win.webContents.openDevTools()  //development moode
}


app.on("ready", newApp);

let camState   = 0
let leftLight  = 0
let rightLight = 0
let rearLight  = 0
let btn1Color = []
let btn2Color = []
let btn3Color = []

ipcMain.on('puttonPress', (event, data) => {
  console.log(data)
  if (data == "cam") {
    if (camState == 1)     
        {camState = 0}
    else 
        {camState = 1}
  }

  if (data == "leftOn") {  
    leftLight = 1
  }
  if (data == "leftOff") {  
    leftLight = 0
  }

  // if (data == "rightOn") {  
  //   rightLight = 1
  // }
  // if (data == "rightOff") {  
  //   rightLight = 0
  // }

  if (data == "rearOn") {  
    rearLight = 1
  }
  if (data == "rearOff") {  
    rearLight = 0
  }

  // --- SLIDER HANDLING ---
  if (typeof data === "object" && data.rightLight !== undefined) {
    rightLight = data.rightLight;   // <-- update value
  }

    if (typeof data === "object" && data.btn1Color !== undefined) {
      // console.log(data.btn1Color)
      btn1Color = data.btn1Color;
    }

    if (typeof data === "object" && data.btn2Color !== undefined) {
      // console.log(data.btn2Color)
      btn2Color = data.btn2Color;
    }

    if (typeof data === "object" && data.btn3Color !== undefined) {
      // console.log(data.btn3Color)
      btn3Color = data.btn3Color;
    }    
  // const webContents = event.sender
  // const win = BrowserWindow.fromWebContents(webContents)
  // win.setTitle(title) 

    // Read the JSON file 
  const filePath = 'kph.json';

  let jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8')); 
  // Add or edit data 
  jsonData.kamera = camState; 
  jsonData.leftLight = leftLight;
  jsonData.rightLight =rightLight;
  jsonData.rearLight = rearLight;
  if (btn1Color.length) {
  jsonData.btn1Color = btn1Color;
  }
  if (btn2Color.length) {
  jsonData.btn2Color = btn2Color;
  }
  if (btn3Color.length) {
  jsonData.btn3Color = btn3Color;
  }
  // Write the JSON file 
  // app.commandLine.appendSwitch("enable-experimental-web-platform-features");
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), function(err){
    if(err) {
      return alert(err);
    }
  }); 


  // io.on('connection', (socket) => {
    // socket.emit('hi');
    // socket.broadcast.emit('hi');
  //   socket.emit('get-data-python', 'Test data from the UI', (err, res) => {
  //     console.log(res)
  // })
  // });


})



const SerialPort = require('serialport');
let espPort = null;

// Internal write queue
let writeQueue = [];
let isWriting = false;


// ---------------------------------------------------------
// Helper: Ensure port is open
// ---------------------------------------------------------
function ensurePortOpen() {
    return new Promise((resolve, reject) => {

        // No port at all
        if (!espPort) return reject("Port not initialized");

        // Already open
        if (espPort.isOpen) return resolve();

        // Try to open
        espPort.open(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}


// ---------------------------------------------------------
// Queue processor
// ---------------------------------------------------------
async function processQueue() {
    if (isWriting) return;  // Already processing
    if (writeQueue.length === 0) return; // Nothing to process

    isWriting = true;

    while (writeQueue.length > 0) {
        const { data, resolve, reject } = writeQueue.shift();

        try {
            // Make sure port is open before every write
            await ensurePortOpen();

            await new Promise((res, rej) => {
                espPort.write(Buffer.from(data), err => {
                    if (err) rej(err);
                    else res();
                });
            });

            resolve(true);  // success for this write
        } catch (err) {
            reject(err);
        }
    }

    isWriting = false;
}


// ---------------------------------------------------------
// IPC: Write command (queued)
// ---------------------------------------------------------
ipcMain.handle("serialWrite", async (event, byteArray) => {
    return new Promise((resolve, reject) => {
        writeQueue.push({ data: byteArray, resolve, reject });
        processQueue(); // Start queue processor
    });
});


// ---------------------------------------------------------
// List ports
// ---------------------------------------------------------
ipcMain.handle('listSerialPorts', async () => {
    const ports = await SerialPort.list();

    return ports.filter(p => {
        return (
            p.vendorId?.toLowerCase() === '10c4' ||
            p.vendorId?.toLowerCase() === '1a86' ||
            p.manufacturer?.toLowerCase().includes("silicon labs") ||
            p.manufacturer?.toLowerCase().includes("esp")
        );
    });
});


// ---------------------------------------------------------
// Open serial port
// ---------------------------------------------------------
ipcMain.handle('serialOpen', async (event, portPath) => {

    if (espPort && espPort.isOpen) {
        await new Promise(resolve => espPort.close(resolve));
    }

    espPort = new SerialPort(portPath, {
        baudRate: 115200,
        autoOpen: false,
        lock: false
    });

    espPort.on("data", data => {
        event.sender.send("serialData", data.toString("utf8").trim());
    });

    espPort.on("error", err => {
        console.error("[Serial Error]", err);
    });

    return new Promise((resolve, reject) => {
        espPort.open(err => {
            if (err) reject(err);
            else resolve(true);
        });
    });
});


// ---------------------------------------------------------
// Close port
// ---------------------------------------------------------
ipcMain.handle("serialClose", async () => {
    if (!espPort) return false;

    return new Promise(resolve => {
        espPort.close(() => {
            espPort = null;
            writeQueue = [];       // clear pending writes
            isWriting = false;
            resolve(true);
        });
    });
});




