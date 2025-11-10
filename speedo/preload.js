// const { contextBridge, ipcRenderer } = require('electron/renderer')

// contextBridge.exposeInMainWorld('electronAPI', {
//   setTitle: (title) => ipcRenderer.send('set-title', title)
// })


const { contextBridge, ipcRenderer } = require('electron')

// White-listed channels.
const ipc = {
    'render': {
        // From render to main.
        'send': ['puttonPress'],
        // From main to render.
        'receive': [
            'camera'
        ],
        // From render to main and back again.
        'invoke': [
            'listSerialPorts',
            'saveConfigurationFile',
            'openConfigurationFile',
            'openPathDialog',
            'saveConfig',
            'serialInterface',
            'modbus'
        ]
    }
};

// Exposed protected methods in the render process.
contextBridge.exposeInMainWorld(
    // Allowed 'ipcRenderer' methods.
    'api', {
    // From render to main.
    send: (channel, args) => {
        let validChannels = ipc.render.send;
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, args);
        }
    },
    // From main to render.
    receive: (channel, listener) => {
        let validChannels = ipc.render.receive;
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes sender.
            ipcRenderer.on(channel, (event, ...args) => listener(...args));
        }
    },
    // From render to main and back again.
    invoke: (channel, args) => {
        let validChannels = ipc.render.invoke;
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, args);
        }
    }
}
);