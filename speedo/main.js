// const electron = require('electron');


const { app, BrowserWindow } = require("electron");
// const url = require("url");

app.$ = app.jQuery = require("./jquery-3.5.1.min.js");


const path = require('path');

require('electron-reload')(__dirname + '/app/index.html', {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});


function newApp() {
  // win = new BrowserWindow({backgroundColor: "#112", width : 1024, height : 600, frame: false, x: 0, y: 0});       //<- removes border
  win = new BrowserWindow({ backgroundColor: "#112", width : 1024, height : 600, x: 900, y: 0});
  win.removeMenu()
  win.loadFile('index.html');
  // win.webContents.openDevTools()  //development moode
}




app.on("ready", newApp);
