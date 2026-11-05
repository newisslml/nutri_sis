// Backend: proceso principal de Electron. Único que toca el disco y la base de datos.
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { appendFileSync, existsSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { entradas } from '../shared/contratos'
import { crearCanales } from './canales'

// NUTRI_DATOS permite apuntar a una carpeta de prueba sin tocar los datos reales.
app.setPath('userData', process.env.NUTRI_DATOS ?? join(app.getPath('appData'), 'SistemaNutri'))

// Registro de errores en registro.log, junto a los datos: errores del backend (console.error), excepciones no atrapadas y
// errores y caídas de la ventana. Al pasar 1 MB queda uno anterior (registro.log.1). Solo mensajes de error, no datos de pacientes.
const REGISTRO = join(app.getPath('userData'), 'registro.log')
function registrar(...partes: unknown[]): void {
  try {
    if (existsSync(REGISTRO) && statSync(REGISTRO).size > 1_000_000) renameSync(REGISTRO, `${REGISTRO}.1`)
    const texto = partes.map((p) => (p instanceof Error ? (p.stack ?? p.message) : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
    appendFileSync(REGISTRO, `${new Date().toISOString()} ${texto}\n`)
  } catch {
    // sin registro no hay dónde avisar; la app sigue
  }
}
const errorConsola = console.error
console.error = (...partes: unknown[]) => {
  registrar(...partes)
  errorConsola(...partes)
}
process.on('uncaughtException', (e) => {
  registrar('excepción no atrapada', e)
  dialog.showErrorBox('Error inesperado', `${e.message}\n\nQuedó en ${REGISTRO}`)
})
process.on('unhandledRejection', (e) => registrar('promesa rechazada', e))

// safeStorage cifra con la cuenta de Windows (DPAPI): "recordar en este equipo" no sirve con otra cuenta ni en otro computador.
const canales = crearCanales(app.getPath('userData'), {
  disponible: () => safeStorage.isEncryptionAvailable(),
  cifrar: (texto) => safeStorage.encryptString(texto),
  descifrar: (dato) => safeStorage.decryptString(dato)
})
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

canales.manejar('archivos.elegirCarpeta', async ({ titulo }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], {
    title: titulo,
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : (filePaths[0] ?? null)
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
  ventana.webContents.on('console-message', ({ level, message, sourceId, lineNumber }) => {
    if (level === 'error') registrar('ventana', message, `${sourceId}:${lineNumber}`)
  })
  ventana.webContents.on('render-process-gone', (_evento, { reason }) => registrar('la ventana se cayó', reason))
  if (process.env.ELECTRON_RENDERER_URL) ventana.loadURL(process.env.ELECTRON_RENDERER_URL)
  else ventana.loadFile(join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => BrowserWindow.getAllWindows()[0]?.focus())
app.whenReady().then(crearVentana)
app.on('window-all-closed', () => app.quit())
app.on('will-quit', canales.cerrar) // respalda (si hubo cambios) y cierra la base
