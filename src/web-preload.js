// Ruleaza in paginile browserului integrat. Pe YouTube forteaza H.264 (decodare pe placa video),
// in loc de VP9/AV1 care incarca mult procesorul pe calculatoare slabe.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

function forceH264() {
  const blocked = /vp0?9|vp8|av01|av1/i;
  const ms = window.MediaSource;
  if (ms && ms.isTypeSupported) {
    const orig = ms.isTypeSupported.bind(ms);
    ms.isTypeSupported = (type) => (blocked.test(type) ? false : orig(type));
  }
  const proto = HTMLMediaElement.prototype;
  const canPlay = proto.canPlayType;
  proto.canPlayType = function (type) { return blocked.test(type) ? '' : canPlay.call(this, type); };
  const mc = navigator.mediaCapabilities;
  if (mc && mc.decodingInfo) {
    const orig = mc.decodingInfo.bind(mc);
    mc.decodingInfo = (cfg) => {
      const type = cfg && cfg.video && cfg.video.contentType;
      if (type && blocked.test(type)) return Promise.resolve({ supported: false, smooth: false, powerEfficient: false });
      return orig(cfg);
    };
  }
}

try {
  if (/(^|\.)youtube\.com$/.test(location.hostname)) {
    const flags = ipcRenderer.sendSync('web:flags') || {};
    if (flags.h264) {
      if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: forceH264 });
      else webFrame.executeJavaScript(`(${forceH264.toString()})()`);
    }
  }
} catch { /* pagina fara acces */ }
