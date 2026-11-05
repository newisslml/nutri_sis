// Canales del backend sin Electron: la app de escritorio los atiende por IPC (index.ts) y el modo web de prueba por HTTP (web.ts).
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ZodError, type z } from 'zod'
import { CONFIGURACION_INICIAL, entradas, type Canal, type Configuracion, type Respuesta, type Salidas } from '../shared/contratos'
import { claveATexto, desenvolver, envolver, nuevaClave, textoAClave, type Envoltura } from './claves'
import * as configuracion from './configuracion'
import * as controles from './controles'
import { abrirBase, VERSION_ESQUEMA, type DB } from './db'
import * as demo from './demo'
import * as pacientes from './pacientes'
import * as respaldo from './respaldo'

function mensajeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join('. ')
  const mensaje = e instanceof Error ? e.message : String(e)
  if (mensaje.includes('UNIQUE constraint failed: paciente.rut')) return 'Ya existe un paciente con ese RUT'
  return mensaje
}

/** Cifra con la cuenta del sistema operativo (safeStorage de Electron, DPAPI en Windows) para recordar la sesión en este equipo. */
export type Guardian = { disponible(): boolean; cifrar(texto: string): Buffer; descifrar(dato: Buffer): string }

/**
 * carpeta: donde viven nutri.db y claves.json. archivos.guardarPdf y archivos.elegirCarpeta dependen de la ventana: los registra
 * quien llama. Sin guardian (modo web) no se puede recordar la sesión.
 */
export function crearCanales(carpeta: string, guardian: Guardian | null = null) {
  const RUTA_DB = join(carpeta, 'nutri.db')
  // Sin claves.json solo abre la clave de recuperación: por eso el respaldo copia los dos.
  const RUTA_CLAVES = join(carpeta, 'claves.json')
  const RUTA_RECORDADA = join(carpeta, 'sesion-recordada.bin')

  let db: DB | null = null
  let clave: Buffer | null = null
  let profesionalId = 0
  // La última configuración leída: el respaldo al cerrar la usa aunque la base ya esté bloqueada.
  let config: Configuracion = CONFIGURACION_INICIAL
  let abiertaEnEstaSesion = false // solo entonces puede haber cambios que respaldar al cerrar
  let intentoRecordada = false
  const manejadores = new Map<string, (entrada: unknown) => unknown>()

  function base(): DB {
    if (!db) throw new Error('La base de datos está bloqueada')
    return db
  }

  function abrir(k: Buffer): void {
    try {
      db = abrirBase(RUTA_DB, k)
    } catch (e) {
      if ((e as { code?: string }).code === 'SQLITE_NOTADB') throw new Error('Clave incorrecta')
      throw e
    }
    clave = k
    abiertaEnEstaSesion = true
    profesionalId = (db.prepare('SELECT min(id) AS id FROM profesional').get() as { id: number }).id
    config = configuracion.leer(db)
  }

  function cerrarBase(): void {
    db?.close()
    db = null
    clave = null
  }

  /** Escribe claves.json con la clave cifrada por la contraseña; primero a un temporal, para no dejarlo a medias. */
  function guardarClaves(k: Buffer, contrasena: string): void {
    writeFileSync(`${RUTA_CLAVES}.tmp`, JSON.stringify({ version: 1, contrasena: envolver(k, contrasena) }))
    renameSync(`${RUTA_CLAVES}.tmp`, RUTA_CLAVES)
  }

  /** La clave de la base a partir de la contraseña (claves.json) o de la clave de recuperación; null si no corresponde. */
  function claveDe(secreto: string): Buffer | null {
    const k = textoAClave(secreto)
    if (k || !existsSync(RUTA_CLAVES)) return k
    return desenvolver((JSON.parse(readFileSync(RUTA_CLAVES, 'utf8')) as { contrasena: Envoltura }).contrasena, secreto)
  }

  /** Guarda la clave cifrada con la cuenta del sistema. Si no se puede, la sesión sigue abierta igual: solo no queda recordada. */
  function recordar(k: Buffer): void {
    try {
      if (guardian?.disponible()) writeFileSync(RUTA_RECORDADA, guardian.cifrar(k.toString('hex')))
    } catch (e) {
      console.error('recordar sesión', e)
    }
  }

  /** Al iniciar, abre sola si el profesional pidió recordar la sesión en este equipo. Si falla, la olvida y pide la contraseña. */
  function abrirRecordada(): void {
    intentoRecordada = true
    if (!guardian?.disponible() || !existsSync(RUTA_RECORDADA) || !existsSync(RUTA_DB)) return
    try {
      abrir(Buffer.from(guardian.descifrar(readFileSync(RUTA_RECORDADA)), 'hex'))
    } catch (e) {
      console.error('sesión recordada', e)
      rmSync(RUTA_RECORDADA, { force: true })
    }
  }

  const carpetaRespaldo = () => config.carpetaRespaldo ?? join(carpeta, 'respaldos')
  function respaldar(): string | null {
    const destino = carpetaRespaldo()
    try {
      return respaldo.respaldar(carpeta, destino, config.copiasRespaldo)
    } catch (e) {
      console.error('respaldo', e)
      throw new Error(`No se pudo respaldar en ${destino}: revise que la carpeta (o el pendrive) esté disponible`)
    }
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

  manejar('sesion.estado', () => {
    if (!db && !intentoRecordada) abrirRecordada()
    return {
      configurada: existsSync(RUTA_DB),
      abierta: db !== null,
      profesional: db ? (db.prepare('SELECT nombre FROM profesional WHERE id = ?').get(profesionalId) as { nombre: string }).nombre : null,
      recordarDisponible: guardian?.disponible() ?? false,
      recordada: existsSync(RUTA_RECORDADA)
    }
  })

  manejar('sesion.configurar', ({ nombreProfesional, contrasena }) => {
    if (existsSync(RUTA_DB)) throw new Error('Ya existe una base de datos en este equipo')
    const k = nuevaClave()
    guardarClaves(k, contrasena)
    const nueva = abrirBase(RUTA_DB, k)
    nueva.prepare('INSERT INTO profesional (nombre) VALUES (?)').run(nombreProfesional)
    nueva.close()
    abrir(k)
    return { claveRecuperacion: claveATexto(k) }
  })

  manejar('sesion.desbloquear', ({ secreto, recordar: recordarEquipo }) => {
    if (!textoAClave(secreto) && !existsSync(RUTA_CLAVES)) throw new Error('Falta claves.json: use la clave de recuperación')
    const k = claveDe(secreto)
    if (!k) throw new Error('Contraseña incorrecta')
    abrir(k)
    if (recordarEquipo) recordar(k)
    else if (recordarEquipo === false) rmSync(RUTA_RECORDADA, { force: true })
    return null
  })

  manejar('sesion.bloquear', () => {
    cerrarBase()
    return null
  })

  manejar('sesion.cambiarContrasena', ({ actual, nueva }) => {
    base()
    const k = claveDe(actual)
    if (!k || !clave?.equals(k)) throw new Error('La contraseña actual (o la clave de recuperación) no es correcta')
    guardarClaves(k, nueva)
    return null
  })

  manejar('sesion.olvidarEquipo', () => {
    rmSync(RUTA_RECORDADA, { force: true })
    return null
  })

  manejar('configuracion.obtener', () => configuracion.leer(base()))
  manejar('configuracion.guardar', (c) => {
    if (c.carpetaRespaldo !== null && resolve(c.carpetaRespaldo) === resolve(carpeta)) {
      throw new Error('Elija otra carpeta para los respaldos: esa es la carpeta de los datos')
    }
    config = configuracion.guardar(base(), c, profesionalId)
    return config
  })

  // carpeta null: la configurada. Si la elegida ya es un respaldo (tiene nutri.db) se lista solo ella.
  manejar('respaldo.listar', ({ carpeta: elegida }) => {
    const c = elegida ?? (base(), carpetaRespaldo())
    return { carpeta: c, respaldos: existsSync(join(c, 'nutri.db')) ? [respaldo.describir(c)] : respaldo.listar(c) }
  })
  manejar('respaldo.crear', () => {
    base()
    return { ruta: respaldar() }
  })
  // También sin abrir la base (equipo nuevo o base dañada): pide la contraseña del respaldo o la clave de recuperación.
  manejar('respaldo.restaurar', ({ carpeta: elegida, secreto }) => {
    const k = respaldo.verificar(elegida, secreto, VERSION_ESQUEMA)
    cerrarBase()
    respaldo.restaurar(carpeta, elegida)
    if (existsSync(RUTA_RECORDADA)) recordar(k)
    abrir(k)
    return null
  })

  manejar('pacientes.listar', ({ busqueda, perfil }) => pacientes.listar(base(), busqueda, perfil))
  manejar('pacientes.obtener', ({ id }) => pacientes.obtener(base(), id))
  manejar('pacientes.guardar', (p) => pacientes.guardar(base(), p, profesionalId))
  manejar('pacientes.exportar', ({ id }) => pacientes.exportar(base(), id))
  manejar('pacientes.eliminar', ({ id }) => {
    pacientes.eliminar(base(), id, profesionalId)
    return null
  })
  manejar('catalogos.met', () => controles.actividades(base()))
  manejar('catalogos.guardarMet', (a) => controles.guardarActividad(base(), a, profesionalId))
  manejar('catalogos.eliminarMet', ({ id }) => {
    controles.eliminarActividad(base(), id, profesionalId)
    return null
  })
  manejar('demo.crear', () => ({ pacientes: demo.crear(base(), profesionalId, config) }))
  manejar('demo.eliminar', () => ({ pacientes: demo.eliminar(base(), profesionalId) }))
  manejar('controles.listar', ({ pacienteId }) => controles.listar(base(), pacienteId))
  manejar('controles.crear', ({ pacienteId }) => ({ id: controles.crear(base(), pacienteId, profesionalId, config) }))
  manejar('controles.evolucion', ({ pacienteId }) => controles.evolucion(base(), pacienteId))
  manejar('controles.obtener', ({ id }) => controles.obtener(base(), id))
  manejar('controles.descartar', ({ id }) => {
    controles.descartar(base(), id)
    return null
  })
  manejar('controles.guardar', (c) => controles.guardar(base(), c, profesionalId))

  /** Al salir: respalda si la base se abrió en esta ejecución (sin cambios no crea copia) y la cierra. */
  function cerrar(): void {
    if (abiertaEnEstaSesion && existsSync(RUTA_DB)) {
      try {
        respaldar()
      } catch {
        // ya quedó en el registro; al salir no hay a quién avisar
      }
    }
    cerrarBase()
  }

  return { manejar, atender, cerrar }
}
