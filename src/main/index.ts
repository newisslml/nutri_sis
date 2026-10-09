// Backend: proceso principal de Electron. Único que toca el disco y la base de datos.
import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ZodError, type z } from 'zod'
import { entradas, type Canal, type Respuesta, type Salidas } from '../shared/contratos'
import { claveATexto, desenvolver, envolver, nuevaClave, textoAClave, type Envoltura } from './claves'
import { abrirBase, type DB } from './db'
import * as pacientes from './pacientes'

// NUTRI_DATOS permite apuntar a una carpeta de prueba sin tocar los datos reales.
app.setPath('userData', process.env.NUTRI_DATOS ?? join(app.getPath('appData'), 'SistemaNutri'))
const RUTA_DB = join(app.getPath('userData'), 'nutri.db')
// Respaldo futuro: copiar claves.json junto a nutri.db; sin él solo abre la clave de recuperación.
const RUTA_CLAVES = join(app.getPath('userData'), 'claves.json')

let db: DB | null = null
let profesionalId = 0

function base(): DB {
  if (!db) throw new Error('La base de datos está bloqueada')
  return db
}

function abrir(clave: Buffer): void {
  try {
    db = abrirBase(RUTA_DB, clave)
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_NOTADB') throw new Error('Clave incorrecta')
    throw e
  }
  profesionalId = (db.prepare('SELECT min(id) AS id FROM profesional').get() as { id: number }).id
}

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join('. ')
  const mensaje = e instanceof Error ? e.message : String(e)
  if (mensaje.includes('UNIQUE constraint failed: paciente.rut')) return 'Ya existe un paciente con ese RUT'
  return mensaje
}

function manejar<C extends Canal>(canal: C, fn: (entrada: z.output<(typeof entradas)[C]>) => Salidas[C]): void {
  ipcMain.handle(canal, (_evento, crudo): Respuesta<Salidas[C]> => {
    try {
      return { ok: true, datos: fn(entradas[canal].parse(crudo) as z.output<(typeof entradas)[C]>) }
    } catch (e) {
      console.error(canal, e)
      return { ok: false, error: mensajeError(e) }
    }
  })
}

manejar('sesion.estado', () => ({ configurada: existsSync(RUTA_DB), abierta: db !== null }))

manejar('sesion.configurar', ({ nombreProfesional, contrasena }) => {
  if (existsSync(RUTA_DB)) throw new Error('Ya existe una base de datos en este equipo')
  const clave = nuevaClave()
  writeFileSync(RUTA_CLAVES, JSON.stringify({ version: 1, contrasena: envolver(clave, contrasena) }))
  db = abrirBase(RUTA_DB, clave)
  profesionalId = Number(db.prepare('INSERT INTO profesional (nombre) VALUES (?)').run(nombreProfesional).lastInsertRowid)
  return { claveRecuperacion: claveATexto(clave) }
})

manejar('sesion.desbloquear', ({ secreto }) => {
  let clave = textoAClave(secreto)
  if (!clave) {
    if (!existsSync(RUTA_CLAVES)) throw new Error('Falta claves.json: use la clave de recuperación')
    const archivo = JSON.parse(readFileSync(RUTA_CLAVES, 'utf8')) as { contrasena: Envoltura }
    clave = desenvolver(archivo.contrasena, secreto)
    if (!clave) throw new Error('Contraseña incorrecta')
  }
  abrir(clave)
  return null
})

manejar('sesion.bloquear', () => {
  db?.close()
  db = null
  return null
})

manejar('pacientes.listar', ({ busqueda, perfil }) => pacientes.listar(base(), busqueda, perfil))
manejar('pacientes.obtener', ({ id }) => pacientes.obtener(base(), id))
manejar('pacientes.guardar', (p) => pacientes.guardar(base(), p, profesionalId))

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
app.on('will-quit', () => db?.close())
