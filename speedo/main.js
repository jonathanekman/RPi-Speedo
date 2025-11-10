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

ipcMain.on('puttonPress', (event, title) => {
  console.log(title)
  if (title == "cam") {
    if (camState == 1)     
        {camState = 0}
    else 
        {camState = 1}
  }

  if (title == "leftOn") {  
    leftLight = 1
  }
  if (title == "leftOff") {  
    leftLight = 0
  }

  if (title == "rightOn") {  
    rightLight = 1
  }
  if (title == "rightOff") {  
    rightLight = 0
  }

  if (title == "rearOn") {  
    rearLight = 1
  }
  if (title == "rearOff") {  
    rearLight = 0
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







