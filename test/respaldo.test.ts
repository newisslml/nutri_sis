// Prueba real de respaldo y restauración sobre una base cifrada en una carpeta temporal.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { abrirCifrada, claveATexto, envolver, nuevaClave } from '../src/main/claves.ts'
import { listar, respaldar, restaurar, verificar } from '../src/main/respaldo.ts'

function instalacion(clave: Buffer, contrasena: string) {
  const datos = mkdtempSync(join(tmpdir(), 'nutri-'))
  const db = abrirCifrada(join(datos, 'nutri.db'), clave)
  db.exec("CREATE TABLE paciente (id INTEGER PRIMARY KEY, nombres TEXT); INSERT INTO paciente (nombres) VALUES ('Ana'); PRAGMA user_version = 3")
  writeFileSync(join(datos, 'claves.json'), JSON.stringify({ version: 1, contrasena: envolver(clave, contrasena) }))
  return { datos, db }
}
const nombres = (ruta: string, clave: Buffer) => {
  const db = abrirCifrada(ruta, clave)
  const filas = db.prepare('SELECT nombres FROM paciente ORDER BY id').pluck().all()
  db.close()
  return filas
}

test('respaldo: copia cifrada, sin duplicados si no hubo cambios y rotación', () => {
  const clave = nuevaClave()
  const { datos, db } = instalacion(clave, 'contraseña 1')
  const destino = join(datos, 'respaldos')
  assert.equal(db.pragma('journal_mode', { simple: true }), 'delete') // la copia de archivo depende de esto

  const primero = respaldar(datos, destino, 2, new Date(2026, 10, 4, 9, 0, 0))!
  assert.match(primero, /respaldo-2026-11-04_090000$/)
  assert.notEqual(readFileSync(join(primero, 'nutri.db')).subarray(0, 15).toString(), 'SQLite format 3') // sigue cifrada
  assert.ok(existsSync(join(primero, 'claves.json')))
  assert.equal(respaldar(datos, destino, 2, new Date(2026, 10, 4, 9, 5, 0)), null) // sin cambios

  // En caliente: con la base abierta, entre escrituras.
  db.prepare("INSERT INTO paciente (nombres) VALUES ('Berta')").run()
  respaldar(datos, destino, 2, new Date(2026, 10, 4, 10, 0, 0))
  db.prepare("INSERT INTO paciente (nombres) VALUES ('Carla')").run()
  respaldar(datos, destino, 2, new Date(2026, 10, 4, 11, 0, 0))
  const lista = listar(destino)
  assert.deepEqual(lista.map((r) => r.fecha), ['2026-11-04T11:00:00', '2026-11-04T10:00:00'])
  assert.deepEqual(nombres(join(lista[0].carpeta, 'nutri.db'), clave), ['Ana', 'Berta', 'Carla'])
  db.close()
  rmSync(datos, { recursive: true })
})

test('restauración: verifica antes de reemplazar y guarda la base anterior', () => {
  const clave = nuevaClave()
  const { datos, db } = instalacion(clave, 'contraseña vieja')
  const destino = join(datos, 'respaldos')
  const respaldo = respaldar(datos, destino, 5)!
  db.prepare("INSERT INTO paciente (nombres) VALUES ('Después del respaldo')").run()
  db.close()

  assert.throws(() => verificar(respaldo, 'otra', 3), /Contraseña incorrecta/)
  assert.throws(() => verificar(respaldo, 'contraseña vieja', 2), /versión más nueva/)
  assert.throws(() => verificar(datos + '-no-existe', 'contraseña vieja', 3), /no tiene nutri.db/)
  assert.deepEqual(verificar(respaldo, 'contraseña vieja', 3), clave)
  assert.deepEqual(verificar(respaldo, claveATexto(clave), 3), clave) // también con la clave de recuperación

  // Un archivo dañado no pasa la verificación.
  const danado = join(datos, 'danado')
  respaldar(datos, danado, 1)
  const ruta = join(listar(danado)[0].carpeta, 'nutri.db')
  const bytes = readFileSync(ruta)
  bytes.fill(0, 4096, 8192)
  writeFileSync(ruta, bytes)
  assert.throws(() => verificar(listar(danado)[0].carpeta, 'contraseña vieja', 3), /dañad/)

  restaurar(datos, respaldo)
  assert.deepEqual(nombres(join(datos, 'nutri.db'), clave), ['Ana'])
  assert.deepEqual(nombres(join(datos, 'nutri.db.antes-de-restaurar.bak'), clave), ['Ana', 'Después del respaldo'])
  rmSync(datos, { recursive: true })
})
