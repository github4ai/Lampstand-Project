const { contextBridge, ipcRenderer } = require('electron')

// The audience window is a sandboxed data-URL page, so this is the only way a projected
// verse reference can tell the studio that someone asked for it.
contextBridge.exposeInMainWorld('lampstandAudience', {
  selectVerse: (reference) => ipcRenderer.send('lampstand:presentation-verse', reference),
})
