// Única puerta entre la ventana y el backend: sin acceso a Node ni al disco.
import { contextBridge, ipcRenderer } from 'electron'
import type { ApiNutri } from '../shared/contratos'

const api: ApiNutri = { invocar: (canal, entrada) => ipcRenderer.invoke(canal, entrada) }
contextBridge.exposeInMainWorld('nutri', api)
