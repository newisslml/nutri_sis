import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claveATexto, desenvolver, envolver, nuevaClave, textoAClave } from '../src/main/claves.ts'
import { edadEnAnios, formatearRut, validarRut } from '../src/shared/validaciones.ts'

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
