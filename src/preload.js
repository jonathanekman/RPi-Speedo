const { contextBridge, ipcRenderer } = require('electron');

console.log("preload.js loaded");

// Whitelist channels
const validChannels = {
  send: ['puttonPress'],
  receive: ['camera', 'serialData', 'mqttMessage', 'mqttBatch'],
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


    loadKphJson: () => ipcRenderer.invoke("load-kph-json"),

    // ✔ FIXED — correctly forwards the path string
    serialOpen: (portPath) => ipcRenderer.invoke("serialOpen", portPath),

    // ✔ Also useful if referenced
    serialWrite: (bytes) => ipcRenderer.invoke("serialWrite", bytes),

    serialClose: () => ipcRenderer.invoke("serialClose"),

    // 🔥 New batched MQTT
    onMqttBatch: (cb) => {
      const handler = (_e, batch) => cb(batch);
      ipcRenderer.on("mqttBatch", handler);
      return () => ipcRenderer.removeListener("mqttBatch", handler);
    },
});

