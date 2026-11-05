// Respaldo: una carpeta por copia (respaldo-AAAA-MM-DD_HHMMSS) con nutri.db tal como está en disco, que sigue cifrada, y claves.json.
// La base usa el diario por defecto (journal_mode DELETE) y better-sqlite3 es síncrono: entre dos llamadas no hay transacción a medias,
// así que copiar el archivo es una copia en caliente consistente. Si algún día se activa WAL, hacer checkpoint antes de copiar.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Respaldo } from '../shared/contratos.ts'
import { abrirCifrada, desenvolver, textoAClave, type Envoltura } from './claves.ts'

const BASE = 'nutri.db'
const CLAVES = 'claves.json'
const PATRON = /^respaldo-(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})$/

const dos = (n: number) => String(n).padStart(2, '0')
const nombre = (f: Date) =>
  `respaldo-${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}_${dos(f.getHours())}${dos(f.getMinutes())}${dos(f.getSeconds())}`
const leer = (carpeta: string, archivo: string) => (existsSync(join(carpeta, archivo)) ? readFileSync(join(carpeta, archivo)) : null)

/** Una carpeta con nutri.db; la fecha sale del nombre o, si se renombró, de la última modificación del archivo. */
export function describir(carpeta: string): Respaldo {
  const { size, mtime } = statSync(join(carpeta, BASE))
  const partes = PATRON.exec(basename(carpeta))
  const fecha = partes ? `${partes[1]}T${partes[2]}:${partes[3]}:${partes[4]}` : nombre(mtime).replace(PATRON, '$1T$2:$3:$4')
  return { carpeta, fecha, bytes: size }
}

/** Respaldos completos dentro de la carpeta, del más reciente al más antiguo. */
export function listar(destino: string): Respaldo[] {
  if (!existsSync(destino)) return []
  return readdirSync(destino)
    .filter((n) => PATRON.test(n) && existsSync(join(destino, n, BASE)))
    .sort()
    .reverse()
    .map((n) => describir(join(destino, n)))
}

/**
 * Copia nutri.db y claves.json de `datos` a una carpeta nueva dentro de `destino` y deja solo las `copias` más recientes.
 * Si nada cambió desde el último respaldo no crea otro (devuelve null), para que abrir y cerrar no desplace copias útiles.
 */
export function respaldar(datos: string, destino: string, copias: number, ahora = new Date()): string | null {
  const base = readFileSync(join(datos, BASE))
  const claves = leer(datos, CLAVES)
  const ultimo = listar(destino)[0]
  if (ultimo) {
    const clavesUltimo = leer(ultimo.carpeta, CLAVES)
    const mismasClaves = claves === null ? clavesUltimo === null : clavesUltimo !== null && claves.equals(clavesUltimo)
    if (mismasClaves && base.equals(readFileSync(join(ultimo.carpeta, BASE)))) return null
  }
  const carpeta = join(destino, nombre(ahora))
  // Se escribe en una carpeta temporal y se renombra al final: un corte a mitad de camino no deja un respaldo incompleto.
  const temporal = `${carpeta}.tmp`
  rmSync(temporal, { recursive: true, force: true })
  mkdirSync(temporal, { recursive: true })
  writeFileSync(join(temporal, BASE), base)
  if (claves) writeFileSync(join(temporal, CLAVES), claves)
  renameSync(temporal, carpeta)
  for (const viejo of listar(destino).slice(copias)) rmSync(viejo.carpeta, { recursive: true })
  return carpeta
}

/**
 * Comprueba que el respaldo abre con el secreto (contraseña que tenía al respaldar o clave de recuperación), que no está dañado
 * y que esta versión del sistema lo sabe abrir. No lo modifica. Devuelve la clave de la base.
 */
export function verificar(carpeta: string, secreto: string, versionMaxima: number): Buffer {
  const ruta = join(carpeta, BASE)
  if (!existsSync(ruta)) throw new Error('La carpeta elegida no tiene nutri.db')
  let clave = textoAClave(secreto)
  if (!clave) {
    const claves = leer(carpeta, CLAVES)
    if (!claves) throw new Error('El respaldo no tiene claves.json: use la clave de recuperación')
    let sobre: Envoltura
    try {
      sobre = (JSON.parse(claves.toString('utf8')) as { contrasena: Envoltura }).contrasena
    } catch {
      throw new Error('El claves.json del respaldo está dañado: use la clave de recuperación')
    }
    clave = desenvolver(sobre, secreto)
    if (!clave) throw new Error('Contraseña incorrecta para este respaldo (es la que tenía el sistema cuando se respaldó)')
  }
  let db
  try {
    db = abrirCifrada(ruta, clave, { readonly: true, fileMustExist: true })
  } catch {
    throw new Error('El respaldo no abre con esa clave o el archivo está dañado')
  }
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('El respaldo está dañado')
    const version = db.pragma('user_version', { simple: true }) as number
    if (version > versionMaxima) throw new Error('El respaldo es de una versión más nueva del sistema: actualice el sistema antes de restaurarlo')
    db.prepare('SELECT count(*) FROM paciente').get() // que sea una base de este sistema
  } catch (e) {
    throw (e as { code?: string }).code ? new Error('El respaldo está dañado o no es de este sistema') : e
  } finally {
    db.close()
  }
  return clave
}

/**
 * Reemplaza nutri.db y claves.json de `datos` por los del respaldo. Antes deja los actuales como *.antes-de-restaurar.bak.
 * La base debe estar cerrada. Si el respaldo no trae claves.json se quita el actual: solo abrirá la clave de recuperación.
 */
export function restaurar(datos: string, carpeta: string): void {
  for (const archivo of [BASE, CLAVES]) {
    const actual = join(datos, archivo)
    if (existsSync(actual)) copyFileSync(actual, `${actual}.antes-de-restaurar.bak`)
  }
  rmSync(join(datos, `${BASE}-journal`), { force: true }) // un diario de la base anterior no debe aplicarse a la restaurada
  copyFileSync(join(carpeta, BASE), join(datos, `${BASE}.restaurando`))
  renameSync(join(datos, `${BASE}.restaurando`), join(datos, BASE))
  if (existsSync(join(carpeta, CLAVES))) copyFileSync(join(carpeta, CLAVES), join(datos, CLAVES))
  else rmSync(join(datos, CLAVES), { force: true })
}
