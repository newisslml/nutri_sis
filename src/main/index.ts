// Backend: proceso principal de Electron. Único que toca el disco y la base de datos.
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { entradas } from '../shared/contratos'
import { crearCanales } from './canales'

// NUTRI_DATOS permite apuntar a una carpeta de prueba sin tocar los datos reales.
app.setPath('userData', process.env.NUTRI_DATOS ?? join(app.getPath('appData'), 'SistemaNutri'))
const canales = crearCanales(app.getPath('userData'))
for (const canal of Object.keys(entradas)) ipcMain.handle(canal, (_evento, crudo) => canales.atender(canal, crudo))

// Carpeta del último PDF guardado: el siguiente diálogo parte ahí y mismaCarpeta guarda sin preguntar.
let carpetaPdf: string | null = null

/** Guarda la ventana actual en PDF (lo que no se imprime lo oculta el CSS @media print de la pantalla). */
canales.manejar('archivos.guardarPdf', async ({ nombre, mismaCarpeta }) => {
  const ventana = BrowserWindow.getAllWindows()[0]
  const archivo = `${nombre.replace(/[\\/:*?"<>|]/g, '-')}.pdf`
  let ruta = mismaCarpeta && carpetaPdf ? join(carpetaPdf, archivo) : null
  if (!ruta) {
    const { canceled, filePath } = await dialog.showSaveDialog(ventana, {
      defaultPath: join(carpetaPdf ?? app.getPath('documents'), archivo),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    ruta = filePath
    carpetaPdf = dirname(filePath)
  }
  writeFileSync(ruta, await ventana.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }))
  return ruta
})

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    title: 'Sistema Nutri',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  ventana.once('ready-to-show', () => ventana.show())
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  ventana.webContents.on('will-navigate', (evento, url) => {
    if (new URL(url).origin !== new URL(ventana.webContents.getURL()).origin) evento.preventDefault()
  })
  if (process.env.ELECTRON_RENDERER_URL) ventana.loadURL(process.env.ELECTRON_RENDERER_URL)
  else ventana.loadFile(join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => BrowserWindow.getAllWindows()[0]?.focus())
app.whenReady().then(crearVentana)
app.on('window-all-closed', () => app.quit())
app.on('will-quit', canales.cerrar)
