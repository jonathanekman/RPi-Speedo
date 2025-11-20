const { contextBridge, ipcRenderer } = require('electron');

const ipc = {
    'render': {
        'send': ['puttonPress'],
        'receive': ['camera', 'serialData'],
        'invoke': [
            'listSerialPorts',
            'serialWrite',
            'serialOpen',
            'serialClose'
        ]
    }
};

contextBridge.exposeInMainWorld('api', {
    send: (channel, args) => {
        if (ipc.render.send.includes(channel)) ipcRenderer.send(channel, args);
    },
    receive: (channel, listener) => {
        if (ipc.render.receive.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => listener(...args));
        }
    },
    invoke: (channel, args) => {
        if (ipc.render.invoke.includes(channel)) return ipcRenderer.invoke(channel, args);
    }
});