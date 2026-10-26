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
  perfInfo: () => ipcRenderer.invoke('perf:info'),
  pos: async (method, params) => {
    const r = await ipcRenderer.invoke('pos:rpc', method, params);
    if (!r.ok) throw new Error(r.error);
    return r.result;
  },
  posData: {
    info: () => ipcRenderer.invoke('pos:data-info'),
    backupNow: () => ipcRenderer.invoke('pos:backup-now'),
    openFolder: () => ipcRenderer.invoke('pos:open-folder'),
    export: () => ipcRenderer.invoke('pos:export'),
    import: () => ipcRenderer.invoke('pos:import'),
    restore: (name) => ipcRenderer.invoke('pos:restore', name),
  },
  on: (channel, cb) => {
    const allowed = ['pos:event', 'adblock:count', 'tunnel:status','browser:open-tab', 'browser:shortcut', 'remote:navigate', 'volume:changed', 'window:fullscreen'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
});
