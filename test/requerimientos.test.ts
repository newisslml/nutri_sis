// Casos de la hoja 24H-REQ de la ficha maestra (valores que muestra el Excel). Fabi debe revisarlos y agregar los suyos.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CODIGOS, cambioEstimadoKgMes, hidratacion, metaKcal, requerimientoDia, totalPorciones } from '../src/calculo/intercambio.ts'
import { PREPARACIONES } from '../src/renderer/src/textos-pauta.ts'

const cerca = (real: number, esperado: number, tolerancia = 0.01) =>
  assert.ok(Math.abs(real - esperado) <= tolerancia, `${real} no es ${esperado} ± ${tolerancia}`)

test('requerimiento del día: caso del Excel (76,5 kg, gasto 2330,59 kcal, 1,8 y 0,5 g/kg)', () => {
  const r = requerimientoDia({ kcal: 2330.5947176875, pesoKg: 76.5, protGKg: 1.8, lipGKg: 0.5 })
  cerca(r.prot, 137.7) // 24H-REQ L65
  cerca(r.lip, 38.25) // L73
  cerca(r.cho, 358.886) // L69: (2330,59 − 4×137,7 − 9×38,25) / 4
  cerca(r.pct.prot, 0.2363, 0.0001) // L63
  cerca(r.pct.lip, 0.1477, 0.0001) // L71
  cerca(r.pct.cho, 0.616, 0.0001) // L67: 1 − 0,2363 − 0,1477
  cerca(r.choGKg, 4.6913, 0.0001) // L66
})

test('carbohidratos negativos cuando proteínas y lípidos superan la meta', () => {
  assert.ok(requerimientoDia({ kcal: 1000, pesoKg: 100, protGKg: 2, lipGKg: 1 }).cho < 0) // 800 + 900 kcal > 1000
})

test('meta calórica con déficit y superávit', () => {
  assert.equal(metaKcal(2000, 'normo', 0), 2000)
  assert.equal(metaKcal(2000, 'deficit', 20), 1600)
  assert.equal(metaKcal(2000, 'superavit', 10), 2200)
})

test('porciones de intercambio a kcal y macros', () => {
  // 1 CER + 1 FRT + 1 LMG (ejemplo de desayuno de la hoja PLAN) = 140 + 65 + 85 kcal
  assert.deepEqual(totalPorciones({ CER: 1, FRT: 1, LMG: 1 }), { kcal: 290, cho: 54, lip: 4, prot: 9 })
  // media porción y aceite por cucharadita: 0,5 CER + 2 AC
  assert.deepEqual(totalPorciones({ CER: 0.5, AC: 2 }), { kcal: 160, cho: 15, lip: 10.5, prot: 1.5 })
  assert.deepEqual(totalPorciones({}), { kcal: 0, cho: 0, lip: 0, prot: 0 })
})

test('hidratación y cambio de peso estimado', () => {
  cerca(hidratacion(76.5).diaL, 2.6775, 0.0001) // PLAN Y40
  cerca(hidratacion(76.5).antesEjercicioL, 0.3825, 0.0001) // PLAN Y41
  cerca(cambioEstimadoKgMes(2500, 2000), 2.143) // 500 kcal/día × 30 / 7000
})

test('las porciones de las preparaciones usan cantidades y códigos de intercambio', () => {
  const porciones = PREPARACIONES.flatMap((p) => p.nombre.split(' — ')[1]?.split(' · ') ?? [])
  assert.ok(porciones.length > 100)
  for (const x of porciones) assert.match(x, new RegExp(`^(\\d+½?|½) (${CODIGOS.join('|')})$`))
})
