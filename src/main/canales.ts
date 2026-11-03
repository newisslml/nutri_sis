// Canales del backend sin Electron: la app de escritorio los atiende por IPC (index.ts) y el modo web de prueba por HTTP (web.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ZodError, type z } from 'zod'
import { entradas, type Canal, type Respuesta, type Salidas } from '../shared/contratos'
import { claveATexto, desenvolver, envolver, nuevaClave, textoAClave, type Envoltura } from './claves'
import * as controles from './controles'
import { abrirBase, type DB } from './db'
import * as pacientes from './pacientes'

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join('. ')
  const mensaje = e instanceof Error ? e.message : String(e)
  if (mensaje.includes('UNIQUE constraint failed: paciente.rut')) return 'Ya existe un paciente con ese RUT'
  return mensaje
}

/** carpeta: donde viven nutri.db y claves.json. archivos.guardarPdf depende de la ventana: lo registra quien llama. */
export function crearCanales(carpeta: string) {
  const RUTA_DB = join(carpeta, 'nutri.db')
  // Respaldo futuro: copiar claves.json junto a nutri.db; sin él solo abre la clave de recuperación.
  const RUTA_CLAVES = join(carpeta, 'claves.json')

  let db: DB | null = null
  let profesionalId = 0
  const manejadores = new Map<string, (entrada: unknown) => unknown>()

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

  function manejar<C extends Canal>(canal: C, fn: (entrada: z.output<(typeof entradas)[C]>) => Salidas[C] | Promise<Salidas[C]>): void {
    manejadores.set(canal, fn as (entrada: unknown) => unknown)
  }

  /** Valida la entrada con el contrato del canal y devuelve el resultado o el error legible; nunca lanza. */
  async function atender(canal: string, crudo: unknown): Promise<Respuesta<unknown>> {
    const fn = manejadores.get(canal)
    if (!fn) return { ok: false, error: `Canal desconocido: ${canal}` }
    try {
      return { ok: true, datos: await fn(entradas[canal as Canal].parse(crudo)) }
    } catch (e) {
      console.error(canal, e)
      return { ok: false, error: mensajeError(e) }
    }
  }

  manejar('sesion.estado', () => ({
    configurada: existsSync(RUTA_DB),
    abierta: db !== null,
    profesional: db ? (db.prepare('SELECT nombre FROM profesional WHERE id = ?').get(profesionalId) as { nombre: string }).nombre : null
  }))

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
  manejar('catalogos.met', () => controles.actividades(base()))
  manejar('controles.listar', ({ pacienteId }) => controles.listar(base(), pacienteId))
  manejar('controles.crear', ({ pacienteId }) => ({ id: controles.crear(base(), pacienteId, profesionalId) }))
  manejar('controles.evolucion', ({ pacienteId }) => controles.evolucion(base(), pacienteId))
  manejar('controles.obtener', ({ id }) => controles.obtener(base(), id))
  manejar('controles.descartar', ({ id }) => {
    controles.descartar(base(), id)
    return null
  })
  manejar('controles.guardar', (c) => controles.guardar(base(), c, profesionalId))

  return { manejar, atender, cerrar: () => db?.close() }
}
