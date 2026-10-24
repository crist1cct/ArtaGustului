const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ag', {
  helper: (cmd, args) => ipcRenderer.invoke('helper', cmd, args),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  remoteInfo: (regenerate) => ipcRenderer.invoke('remote:info', regenerate),
  extList: () => ipcRenderer.invoke('ext:list'),
  extRemove: (id) => ipcRenderer.invoke('ext:remove', id),
  extLoadUnpacked: () => ipcRenderer.invoke('ext:load-unpacked'),
  drmStatus: () => ipcRenderer.invoke('drm:status'),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  fullscreen: (value) => ipcRenderer.invoke('window:fullscreen', value),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  quit: () => ipcRenderer.invoke('app:quit'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  on: (channel, cb) => {
    const allowed = ['browser:open-tab', 'browser:shortcut','remote:navigate', 'volume:changed', 'window:fullscreen'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
});
