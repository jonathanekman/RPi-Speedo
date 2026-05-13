const { contextBridge, ipcRenderer } = require('electron');

console.log("preload.js loaded");

// Whitelist channels
const validChannels = {
  send: ['puttonPress'],
  receive: ['camera', 'serialData', 'mqttMessage', 'mqttBatch', 'gpsData', 'gpsStatus'],
  invoke: [
    'listSerialPorts',
    'serialWrite',
    'serialOpen',
    'serialClose',
    'mqttSubscribe',
    'mqttPublish'
  ]
};


contextBridge.exposeInMainWorld("api", {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),

    receive: (channel, func) => {
        const subscription = (_event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    },

    send: (channel, data) => {
        if (validChannels.send.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },    


    quitApp: () => ipcRenderer.send("quit-app"),

    loadKphJson: () => ipcRenderer.invoke("load-kph-json"),

    // ✔ FIXED — correctly forwards the path string
    serialOpen: (portPath) => ipcRenderer.invoke("serialOpen", portPath),

    // ✔ Also useful if referenced
    serialWrite: (bytes) => ipcRenderer.invoke("serialWrite", bytes),

    serialClose: () => ipcRenderer.invoke("serialClose"),

    // Batched MQTT
    onMqttBatch: (cb) => {
      const handler = (_e, batch) => cb(batch);
      ipcRenderer.on("mqttBatch", handler);
      return () => ipcRenderer.removeListener("mqttBatch", handler);
    },

    // GPS data from serial
    onGpsData: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("gpsData", handler);
      return () => ipcRenderer.removeListener("gpsData", handler);
    },

    // GPS connection status
    onGpsStatus: (cb) => {
      const handler = (_e, connected) => cb(connected);
      ipcRenderer.on("gpsStatus", handler);
      return () => ipcRenderer.removeListener("gpsStatus", handler);
    },

    // Roof slider commands from the local web UI
    onRoofSlider: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("roofSlider", handler);
      return () => ipcRenderer.removeListener("roofSlider", handler);
    },

    // QR code (data URL) pointing at the local roof-control website
    getRoofQr: () => ipcRenderer.invoke("getRoofQr"),
    onRoofQr: (cb) => {
      const handler = (_e, dataUrl) => cb(dataUrl);
      ipcRenderer.on("roofQr", handler);
      return () => ipcRenderer.removeListener("roofQr", handler);
    },

    // Report local slider changes back to the web UI
    reportRoofSlider: (sliderId, value) => ipcRenderer.send("roofSliderUpdate", { sliderId, value }),

    // Webcam streaming for the web UI
    onCameraActive: (cb) => {
      const handler = (_e, active) => cb(active);
      ipcRenderer.on("cameraActive", handler);
      return () => ipcRenderer.removeListener("cameraActive", handler);
    },
    sendCameraFrame: (buf) => ipcRenderer.send("cameraFrame", buf),
});

