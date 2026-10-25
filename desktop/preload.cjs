const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lampstandDesktop', {
  updates: {
    getState: () => ipcRenderer.invoke('lampstand:update-state'),
    check: () => ipcRenderer.invoke('lampstand:check-update'),
    download: () => ipcRenderer.invoke('lampstand:download-update'),
    install: () => ipcRenderer.invoke('lampstand:install-update'),
    reinstall: () => ipcRenderer.invoke('lampstand:reinstall-current'),
    subscribe: (listener) => {
      const handler = (_event, state) => listener(state)
      ipcRenderer.on('lampstand:update-status', handler)
      return () => ipcRenderer.removeListener('lampstand:update-status', handler)
    },
  },
  libraries: {
    getState: () => ipcRenderer.invoke('lampstand:library-state'),
    setManifestUrl: (url) => ipcRenderer.invoke('lampstand:set-library-manifest', url),
    check: () => ipcRenderer.invoke('lampstand:check-library-update'),
    download: () => ipcRenderer.invoke('lampstand:download-library-update'),
    subscribe: (listener) => {
      const handler = (_event, state) => listener(state)
      ipcRenderer.on('lampstand:library-status', handler)
      return () => ipcRenderer.removeListener('lampstand:library-status', handler)
    },
  },
  presentation: {
    getDisplays: () => ipcRenderer.invoke('lampstand:presentation-displays'),
    open: (payload) => ipcRenderer.invoke('lampstand:open-presentation', payload),
    subscribeVerseRequest: (listener) => {
      const handler = (_event, reference) => listener(reference)
      ipcRenderer.on('lampstand:audience-verse', handler)
      return () => ipcRenderer.removeListener('lampstand:audience-verse', handler)
    },
  },
})
