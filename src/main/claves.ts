// Clave de la base de datos: 128 bits aleatorios.
// - Impresa como clave de recuperación (hex agrupado): abre la base aunque se pierda claves.json.
// - Guardada en claves.json cifrada con la contraseña (scrypt + AES-256-GCM).
// Sin contraseña ni clave de recuperación la base no se puede leer, por diseño.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

export type Envoltura = { sal: string; iv: string; tag: string; dato: string }

const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }

export function nuevaClave(): Buffer {
  return randomBytes(16)
}

export function claveATexto(clave: Buffer): string {
  return clave.toString('hex').toUpperCase().match(/.{4}/g)!.join('-')
}

/** Devuelve la clave si el texto tiene forma de clave de recuperación; si no, null. */
export function textoAClave(texto: string): Buffer | null {
  const hex = texto.replace(/[\s-]/g, '')
  return /^[0-9a-fA-F]{32}$/.test(hex) ? Buffer.from(hex, 'hex') : null
}

function derivar(contrasena: string, sal: Buffer): Buffer {
  return scryptSync(contrasena.normalize('NFC'), sal, 32, SCRYPT)
}

export function envolver(clave: Buffer, contrasena: string): Envoltura {
  const sal = randomBytes(16)
  const iv = randomBytes(12)
  const cifrador = createCipheriv('aes-256-gcm', derivar(contrasena, sal), iv)
  const dato = Buffer.concat([cifrador.update(clave), cifrador.final()])
  const b64 = (b: Buffer) => b.toString('base64')
  return { sal: b64(sal), iv: b64(iv), tag: b64(cifrador.getAuthTag()), dato: b64(dato) }
}

/** Devuelve la clave, o null si la contraseña es incorrecta. */
export function desenvolver(e: Envoltura, contrasena: string): Buffer | null {
  const b = (s: string) => Buffer.from(s, 'base64')
  try {
    const descifrador = createDecipheriv('aes-256-gcm', derivar(contrasena, b(e.sal)), b(e.iv))
    descifrador.setAuthTag(b(e.tag))
    return Buffer.concat([descifrador.update(b(e.dato)), descifrador.final()])
  } catch {
    return null
  }
}
