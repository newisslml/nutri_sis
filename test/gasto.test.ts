// Casos calculados a mano. El profesional debe revisarlos y agregar los suyos: sin ellos una fórmula no entra.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularGastoSemanal, calcularTMB, type Bloque, type EntradaGasto } from '../src/calculo/gasto.ts'

const tmb = (id: string, d: Parameters<typeof calcularTMB>[1]) => Math.round(calcularTMB(id, d).tmb)

test('Mifflin-St Jeor', () => {
  // 10×60 + 6,25×165 − 5×30 − 161 = 600 + 1031,25 − 150 − 161 = 1320,25
  assert.equal(tmb('mifflin-st-jeor', { pesoKg: 60, tallaCm: 165, edad: 30, sexo: 'F' }), 1320)
  // 10×80 + 6,25×180 − 5×40 + 5 = 800 + 1125 − 200 + 5 = 1730
  assert.equal(tmb('mifflin-st-jeor', { pesoKg: 80, tallaCm: 180, edad: 40, sexo: 'M' }), 1730)
})

test('FAO/OMS/UNU (Schofield) por tramo de edad', () => {
  const s = (pesoKg: number, edad: number, sexo: 'F' | 'M') => tmb('fao-oms-unu-schofield', { pesoKg, edad, sexo })
  assert.equal(s(70, 25, 'M'), 1746) // 15,057×70 + 692,2 = 1746,19
  assert.equal(s(70, 30, 'M'), 1676) // límite de tramo: 30 años usa 30–60 → 11,472×70 + 873,1 = 1676,14
  assert.equal(s(60, 45, 'F'), 1333) // 8,126×60 + 845,6 = 1333,16
  assert.equal(s(30, 9, 'M'), 1185) // 22,706×30 + 504,3 = 1185,48
  assert.equal(s(45, 14, 'F'), 1295) // 13,384×45 + 692,6 = 1294,88
  assert.equal(s(65, 70, 'F'), 1249) // 9,082×65 + 658,5 = 1248,83
})

test('datos faltantes y población', () => {
  assert.throws(() => calcularTMB('mifflin-st-jeor', { pesoKg: 60, edad: 30, sexo: 'F' }), /Faltan datos.*talla/)
  assert.deepEqual(calcularTMB('mifflin-st-jeor', { pesoKg: 30, tallaCm: 135, edad: 9, sexo: 'M' }).avisos, [
    'Mifflin-St Jeor está validada en adultos de 19 a 78 años'
  ])
})

// Hombre 70 kg, 25 años. Día laboral: sueño 8 h (0,95) + trabajo 8 h (1,5) + trote 1 h (9,8) + 7 h libres en reposo (1,3)
// = 7,6 + 12 + 9,8 + 9,1 = 38,5 MET·h. Fin de semana: sueño 10 h (0,95) + 14 h reposo (1,3) = 9,5 + 18,2 = 27,7 MET·h
const laboral: Bloque[] = [
  { met: 0.95, minutos: 480 },
  { met: 1.5, minutos: 480 },
  { met: 9.8, minutos: 60 }
]
const finde: Bloque[] = [{ met: 0.95, minutos: 600 }]
const base: EntradaGasto = {
  paciente: { pesoKg: 70, edad: 25, sexo: 'M' },
  formulaId: 'fao-oms-unu-schofield',
  modo: 'estandar',
  metReposo: 1.3,
  eta: false,
  semana: [laboral, laboral, laboral, laboral, laboral, finde, finde]
}

test('modo estándar: Σ MET × peso × horas', () => {
  const r = calcularGastoSemanal(base)
  // 38,5 × 70 = 2695; 27,7 × 70 = 1939; promedio (5×2695 + 2×1939) / 7 = 17353 / 7 = 2479
  assert.deepEqual(r.porDia, [2695, 2695, 2695, 2695, 2695, 1939, 1939])
  assert.equal(r.promedio, 2479)
  assert.deepEqual(r.formula, { id: 'fao-oms-unu-schofield', version: 1 })
})

test('modo TMB: TMB/24 × Σ MET × horas', () => {
  // 1746,19 / 24 × 38,5 = 2801,18
  assert.equal(calcularGastoSemanal({ ...base, modo: 'tmb' }).porDia[0], 2801)
})

test('ETA, gestación y TMB manual', () => {
  assert.equal(calcularGastoSemanal({ ...base, eta: true }).porDia[5], 2133) // 1939 × 1,1 = 2132,9
  const gestante = calcularGastoSemanal({ ...base, estado: 'gestacion_t2' })
  assert.equal(gestante.porDia[5], 2224) // 1939 + 285
  assert.match(gestante.avisos.join(), /pregestacional/)
  const manual = calcularGastoSemanal({ ...base, modo: 'tmb', tmbManual: 1824 })
  assert.equal(manual.porDia[5], 2105) // 1824 / 24 × 27,7 = 76 × 27,7 = 2105,2
  assert.deepEqual(manual.formula, { id: 'manual', version: 1 })
  assert.match(calcularGastoSemanal({ ...base, tmbManual: 1824 }).avisos.join(), /no cambia el gasto/)
})

test('niño: fuerza modo TMB con METy', () => {
  // Niño 30 kg, 9 años: TMB 1185,48. Sueño 10 h (0,95) + colegio 6 h (1,5) + juego 2 h (5) + 6 h reposo (1,3)
  // = 9,5 + 9 + 10 + 7,8 = 36,3 MET·h → 1185,48 / 24 × 36,3 = 1793,04
  const dia: Bloque[] = [
    { met: 0.95, minutos: 600 },
    { met: 1.5, minutos: 360 },
    { met: 5, minutos: 120 }
  ]
  const r = calcularGastoSemanal({ ...base, paciente: { pesoKg: 30, edad: 9, sexo: 'M' }, semana: Array(7).fill(dia) })
  assert.equal(r.modo, 'tmb')
  assert.equal(r.porDia[0], 1793)
  assert.match(r.avisos.join(), /Menor de 18/)
})

test('día de más de 24 horas', () => {
  const largo: Bloque[] = [{ met: 1, minutos: 1500 }]
  assert.throws(() => calcularGastoSemanal({ ...base, semana: [...base.semana.slice(0, 6), largo] }), /Domingo suma más de 24 horas/)
})
