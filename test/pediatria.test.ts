// Evaluación pediátrica: los valores de -2 a +3 DE impresos en las tablas de la norma MINSAL 2018 (redondeados a 0,1)
// deben dar un puntaje z a menos de 0,06 del que representan.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CEFALICO_EDAD } from '../src/calculo/oms.ts'
import { edadMesesDias, evaluarPediatria, type DatosPediatricos } from '../src/calculo/pediatria.ts'

const z = (d: DatosPediatricos, sigla: string) => evaluarPediatria(d)!.indicadores.find((i) => i.sigla === sigla)!.z
const cerca = (real: number, esperado: number) => assert.ok(Math.abs(real - esperado) < 0.06, `${real} no está cerca de ${esperado}`)

test('edad: meses cumplidos y días sobre el último mes', () => {
  assert.deepEqual(edadMesesDias('2026-01-10', '2026-06-24'), { meses: 5, dias: 14 })
  assert.deepEqual(edadMesesDias('2026-01-10', '2026-07-05'), { meses: 5, dias: 25 })
  assert.deepEqual(edadMesesDias('2025-01-31', '2025-03-01'), { meses: 1, dias: 1 })
})

test('P/E, T/E y P/T bajo 5 años contra las columnas DE de la norma', () => {
  const nina6m = { sexo: 'F', nacimiento: '2026-01-01', fecha: '2026-07-01', tallaCm: 65.7 } as const
  ;[5.7, 6.5, 7.3, 8.2, 9.3].forEach((peso, i) => cerca(z({ ...nina6m, pesoKg: peso }, 'P/E'), i - 2))
  ;[61.2, 63.5, 65.7, 68.0, 70.3].forEach((talla, i) => cerca(z({ ...nina6m, pesoKg: 7.3, tallaCm: talla }, 'T/E'), i - 2))
  // Peso para la longitud a los 87 cm (niño de 18 meses) y para la estatura (niña de 3 años)
  const nino = { sexo: 'M', nacimiento: '2024-01-01', fecha: '2025-07-01', tallaCm: 87 } as const
  ;[10.2, 11.1, 12.0, 13.0, 14.2].forEach((peso, i) => cerca(z({ ...nino, pesoKg: peso }, 'P/T'), i - 2))
  const nina = { sexo: 'F', nacimiento: '2022-01-01', fecha: '2025-01-01', tallaCm: 87 } as const
  ;[10.0, 10.9, 11.9, 13.0, 14.3].forEach((peso, i) => cerca(z({ ...nina, pesoKg: peso }, 'P/T'), i - 2))
})

test('IMC/E de 5 a 19 años, con el ajuste de la OMS sobre +3 DE', () => {
  const nina10 = { sexo: 'F', nacimiento: '2016-03-01', fecha: '2026-03-01', tallaCm: 100 } as const // talla 1 m: peso = IMC
  ;[13.5, 14.8, 16.6, 19.0, 22.6, 28.4].forEach((imc, i) => cerca(z({ ...nina10, pesoKg: imc }, 'IMC/E'), i - 2))
  const nino10 = { ...nina10, sexo: 'M' } as const
  ;[13.7, 14.9, 16.4, 18.5, 21.4, 26.1].forEach((imc, i) => cerca(z({ ...nino10, pesoKg: imc }, 'IMC/E'), i - 2))
})

test('bajo 5 años la edad se aproxima al mes siguiente desde los 16 días', () => {
  const nina = { sexo: 'F', nacimiento: '2026-01-10', tallaCm: 65, pesoKg: 7.297 } as const // mediana P/E a los 6 meses
  assert.equal(z({ ...nina, fecha: '2026-06-26' }, 'P/E'), 0) // 5 meses 16 días → 6 meses
  assert.ok(z({ ...nina, fecha: '2026-06-24' }, 'P/E') > 0.3) // 5 meses 14 días → 5 meses
})

test('calificación nutricional por tramo de edad', () => {
  const califica = (d: DatosPediatricos) => evaluarPediatria(d)!.nutricional?.etiqueta
  // Bajo 1 año manda P/E y no hay sobrepeso por P/E; con P/T ≥ +1 DE prima P/T
  const nina6m = { sexo: 'F', nacimiento: '2026-01-01', fecha: '2026-07-01' } as const
  assert.equal(califica({ ...nina6m, pesoKg: 5.5, tallaCm: 65.7 }), 'Desnutrición')
  assert.equal(califica({ ...nina6m, pesoKg: 8.6, tallaCm: 70.3 }), 'Normal') // P/E entre +1 y +2, P/T normal
  assert.equal(califica({ ...nina6m, pesoKg: 9.0, tallaCm: 65.7 }), 'Obesidad') // P/T ≥ +2
  // De 1 a 5 años, P/T
  const nino = { sexo: 'M', nacimiento: '2024-01-01', fecha: '2025-07-01', tallaCm: 87 } as const
  assert.equal(califica({ ...nino, pesoKg: 10.6 }), 'Riesgo de desnutrir')
  assert.equal(califica({ ...nino, pesoKg: 13.5 }), 'Sobrepeso')
  // Desde 5 años 1 mes, IMC/E con obesidad severa
  const nina10 = { sexo: 'F', nacimiento: '2016-03-01', fecha: '2026-03-01', tallaCm: 100 } as const
  assert.equal(califica({ ...nina10, pesoKg: 16.6 }), 'Normal')
  assert.equal(califica({ ...nina10, pesoKg: 25 }), 'Obesidad')
  assert.equal(califica({ ...nina10, pesoKg: 30 }), 'Obesidad severa')
})

test('talla, perímetro cefálico y cintura; desde 19 años 1 mes no aplica', () => {
  const nina6m = { sexo: 'F', nacimiento: '2026-01-01', fecha: '2026-07-01', pesoKg: 7.3 } as const
  assert.equal(evaluarPediatria({ ...nina6m, tallaCm: 61.0 })!.estatural.etiqueta, 'Talla baja')
  assert.equal(evaluarPediatria({ ...nina6m, tallaCm: 63.0 })!.estatural.etiqueta, 'Talla normal baja')
  assert.equal(evaluarPediatria({ ...nina6m, tallaCm: 65.7, cabezaCm: 39.5 })!.cefalico?.etiqueta, 'Microcefalia')
  assert.equal(evaluarPediatria({ ...nina6m, tallaCm: 65.7, cabezaCm: 42 })!.cefalico?.etiqueta, 'Normal')
  // Niña de 10 años: con el p75 que imprime la norma (58,7), 65 cm sería riesgo
  const nina10 = { sexo: 'F', nacimiento: '2016-03-01', fecha: '2026-03-01', tallaCm: 140, pesoKg: 33 } as const
  assert.equal(evaluarPediatria({ ...nina10, cinturaCm: 65 })!.cintura?.etiqueta, 'Normal')
  assert.equal(evaluarPediatria({ ...nina10, cinturaCm: 70 })!.cintura?.etiqueta, 'Riesgo de obesidad abdominal')
  assert.equal(evaluarPediatria({ ...nina10, cinturaCm: 77 })!.cintura?.etiqueta, 'Obesidad abdominal')
  assert.notEqual(evaluarPediatria({ ...nina10, fecha: '2035-03-01' }), null) // 19 años 0 meses
  assert.equal(evaluarPediatria({ ...nina10, fecha: '2035-04-01' }), null)
})

test('prematuros: edad corregida hasta 24 meses (extremos) o 12 (moderados y tardíos)', () => {
  const nina = { sexo: 'F', nacimiento: '2025-01-01', tallaCm: 60 } as const
  // 28 semanas: a los 6 meses cronológicos tiene 3 meses 5 días corregidos (le faltaban 84 días)
  const r = evaluarPediatria({ ...nina, fecha: '2025-07-01', pesoKg: 5.8458, semanasGestacion: 28 })!
  assert.equal(r.edadCorregidaMeses, 3)
  assert.equal(z({ ...nina, fecha: '2025-07-01', pesoKg: 5.8458, semanasGestacion: 28 }, 'P/E'), 0) // mediana a los 3 meses
  assert.equal(evaluarPediatria({ ...nina, fecha: '2025-07-01', pesoKg: 5.8458 })!.edadCorregidaMeses, null)
  // 34 semanas: a los 14 meses tiene 12 meses 17 días corregidos y ya no se corrige, salvo que haya pesado menos de 1.500 g
  const tardio = { ...nina, fecha: '2026-03-01', pesoKg: 9, tallaCm: 75, semanasGestacion: 34 }
  assert.equal(evaluarPediatria(tardio)!.edadCorregidaMeses, null)
  assert.equal(evaluarPediatria({ ...tardio, pesoNacerG: 1400 })!.edadCorregidaMeses, 12)
  // Antes de las 40 semanas corregidas no hay curva OMS
  assert.equal(evaluarPediatria({ ...nina, fecha: '2025-01-15', pesoKg: 1.2, tallaCm: 38, semanasGestacion: 28 }), null)
})

test('peso ideal: mediana de P/T hasta 5 años; después, IMC/E de la mediana × talla²', () => {
  const nino = { sexo: 'M', nacimiento: '2024-01-01', fecha: '2025-07-01', tallaCm: 87, pesoKg: 12 } as const
  assert.deepEqual(evaluarPediatria(nino)!.pesoIdeal, { kg: 11.9916, segun: 'P/T' })
  const nina10 = evaluarPediatria({ sexo: 'F', nacimiento: '2016-03-01', fecha: '2026-03-01', tallaCm: 140, pesoKg: 33 })!.pesoIdeal!
  assert.equal(nina10.segun, 'IMC/E')
  cerca(nina10.kg, 16.6133 * 1.4 ** 2)
})

test('con talla baja el perímetro cefálico se evalúa a la edad talla', () => {
  // Niña de 18 meses con 74 cm (T/E −2,3): 74 cm es la mediana de los 12 meses
  const r = evaluarPediatria({ sexo: 'F', nacimiento: '2024-01-01', fecha: '2025-07-01', pesoKg: 9, tallaCm: 74, cabezaCm: CEFALICO_EDAD.F[12][1] })!
  assert.equal(r.estatural.etiqueta, 'Talla baja')
  assert.deepEqual(r.indicadores.find((i) => i.sigla === 'PCe/E'), { sigla: 'PCe/E', nombre: 'Perímetro cefálico a la edad talla (12 meses)', z: 0 })
})
