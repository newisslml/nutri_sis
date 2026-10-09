import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { claveATexto, desenvolver, envolver, nuevaClave, textoAClave } from '../src/main/claves.ts'
import { parsearCompendio } from '../src/main/compendio.ts'
import { edadEnAnios, edadEnMeses, formatearEdad, formatearRut, validarRut } from '../src/shared/validaciones.ts'

test('RUT: dígito verificador', () => {
  assert.ok(validarRut('12.345.678-5'))
  assert.ok(validarRut('6.000.000-k'))
  assert.ok(!validarRut('12.345.678-9'))
  assert.ok(!validarRut('abc'))
  assert.equal(formatearRut('12.345.678-5'), '12345678-5')
})

test('edad cumplida a la fecha del control', () => {
  assert.equal(edadEnAnios('2000-10-08', '2026-10-08'), 26)
  assert.equal(edadEnAnios('2000-10-09', '2026-10-08'), 25)
  assert.equal(edadEnAnios('2000-11-01', '2026-10-31'), 25)
  assert.equal(edadEnMeses('2025-03-15', '2026-10-14'), 18)
  assert.equal(edadEnMeses('2025-03-15', '2026-10-15'), 19)
  assert.equal(formatearEdad(436), '36 años 4 meses')
  assert.equal(formatearEdad(12), '1 año')
  assert.equal(formatearEdad(8), '8 meses')
  assert.equal(formatearEdad(0), '0 meses')
})

test('clave: contraseña y clave de recuperación', () => {
  const clave = nuevaClave()
  const sobre = envolver(clave, 'contraseña segura')
  assert.deepEqual(desenvolver(sobre, 'contraseña segura'), clave)
  assert.equal(desenvolver(sobre, 'otra'), null)
  const texto = claveATexto(clave)
  assert.match(texto, /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/)
  assert.deepEqual(textoAClave(texto.toLowerCase()), clave)
  assert.equal(textoAClave('contraseña segura'), null)
})

test('compendio MET: 822 actividades de MET.md', () => {
  const actividades = parsearCompendio(readFileSync(new URL('../MET.md', import.meta.url), 'utf8'))
  assert.equal(actividades.length, 822)
  assert.equal(new Set(actividades.map((a) => a.categoria)).size, 21)
  const porCodigo = (c: string) => actividades.find((a) => a.codigo === c)!
  assert.deepEqual(porCodigo('07030'), { codigo: '07030', categoria: 'Inactividad', nombre: 'Dormir', met: 0.95, estimado: false })
  assert.equal(porCodigo('01008').estimado, true)
  assert.equal(porCodigo('01010').nombre.startsWith('Ciclismo, <16 km/h'), true)
})
