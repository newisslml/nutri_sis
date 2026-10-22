// Casos de composición corporal. El profesional debe revisarlos y agregar los suyos.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bicompartimental,
  durninWomersley,
  kerr,
  medidasVacias,
  perfilPhantom,
  PLIEGUES_6,
  PLIEGUES_8,
  somatotipo,
  sumaPliegues,
  type DatosAntropometria,
  type Medidas
} from '../src/calculo/antropometria.ts'

const cerca = (real: number, esperado: number, tolerancia = 0.01) =>
  assert.ok(Math.abs(real - esperado) <= tolerancia, `${real} no está a ±${tolerancia} de ${esperado}`)

// Hombre 30 años, 75 kg, 178 cm, talla sentado 92 cm
const medidas: Medidas = {
  ...medidasVacias(),
  basicos: { tallaSentado: 92 },
  pliegues: { tricipital: 10, subescapular: 12, bicipital: 5, crestaIliaca: 15, supraespinal: 9, abdominal: 18, musloFrontal: 14, pantorrilla: 8 },
  perimetros: { cabeza: 57, brazoRelajado: 31, antebrazo: 27.5, torax: 98, cintura: 82, musloMaximo: 56, pantorrilla: 37 },
  diametros: { biacromial: 40, toraxTransverso: 29, toraxAnteroposterior: 20, biiliocrestideo: 28, humero: 7, femur: 9.8 }
}
const hombre: DatosAntropometria = { pesoKg: 75, tallaCm: 178, edad: 30, sexo: 'M', medidas }
const resultado = <T>(r: { resultado: T } | { faltan: string[] }) => {
  if ('faltan' in r) assert.fail(`Faltan: ${r.faltan.join(', ')}`)
  return r.resultado
}

test('sumatoria de pliegues', () => {
  assert.deepEqual(sumaPliegues(medidas, PLIEGUES_6), { mm: 71 }) // 10 + 12 + 9 + 18 + 14 + 8
  assert.deepEqual(sumaPliegues({ ...medidas, pliegues: { tricipital: 10 } }, ['tricipital', 'abdominal']), {
    faltan: ['abdominal (pliegues)']
  })
})

test('Kerr: 5 componentes ajustados al peso', () => {
  const r = resultado(kerr(hombre))
  // Adiposa bruta: s = 170,18/178; Z = (71 s − 116,41)/34,79; (5,85 Z + 25,6)/s³ = 19,956 kg
  // Peso estructurado 77,611 kg → adiposa ajustada 19,956 × 75/77,611 = 19,285 kg (25,71 %)
  cerca(r.pesoEstructuradoKg, 77.611)
  cerca(r.adiposa.kg, 19.285)
  cerca(r.adiposa.pct, 25.713)
  cerca(r.muscular.kg, 34.964)
  cerca(r.muscular.pct, 46.618)
  cerca(r.osea.kg, 8.205)
  cerca(r.residual.kg, 8.699)
  cerca(r.piel.kg, 3.848)
  cerca(r.adiposa.kg + r.muscular.kg + r.osea.kg + r.residual.kg + r.piel.kg, 75)
  cerca(r.masaLibreGrasaKg, 75 - 19.285)
})

test('Kerr: misma salida que la hoja EVAL de la ficha maestra (±0,01 kg por π en vez de 3,14)', () => {
  const r = resultado(
    kerr({
      pesoKg: 60,
      tallaCm: 160,
      edad: 30,
      sexo: 'M',
      medidas: {
        ...medidasVacias(),
        basicos: { tallaSentado: 50 },
        pliegues: { tricipital: 30, subescapular: 40, supraespinal: 40, abdominal: 30, musloFrontal: 39, pantorrilla: 44 },
        perimetros: { cabeza: 30, brazoRelajado: 30, antebrazo: 30, torax: 40, cintura: 40, musloMaximo: 40, pantorrilla: 40 },
        diametros: { biacromial: 50, toraxTransverso: 50, toraxAnteroposterior: 50, biiliocrestideo: 50, humero: 50, femur: 50 }
      }
    })
  )
  // Valores de la planilla: B81, B75, B105, B113, B89
  cerca(r.adiposa.kg, 24.254)
  cerca(r.muscular.kg, -0.938)
  cerca(r.osea.kg, 31.484)
  cerca(r.residual.kg, 3.069)
  cerca(r.piel.kg, 2.131)
})

test('Kerr: menores de 12 años usan constante de superficie 70,691', () => {
  const adulto = resultado(kerr(hombre))
  const nino = resultado(kerr({ ...hombre, edad: 10 }))
  // Piel bruta 3,982 kg × 70,691/68,308 = 4,121 kg
  cerca(nino.piel.kg * (nino.pesoEstructuradoKg / 75), 4.121)
  assert.ok(nino.piel.kg > adulto.piel.kg)
})

test('Kerr: informa los sitios que faltan', () => {
  const r = kerr({ ...hombre, medidas: { ...medidas, basicos: {}, perimetros: { ...medidas.perimetros, cabeza: undefined } } })
  assert.deepEqual(r, { faltan: ['talla sentado (básicos)', 'cabeza (perímetros)'] })
})

test('Durnin-Womersley + Siri', () => {
  // Σ4 = 5 + 10 + 12 + 15 = 42; D = 1,1765 − 0,0744 log 42 = 1,05573; %G = 495/D − 450 = 18,87 %
  const h = resultado(durninWomersley(hombre))
  cerca(h.densidad, 1.05573, 0.00001)
  cerca(h.grasaPct, 18.87)
  cerca(h.grasaKg, 14.152)
  cerca(h.masaLibreGrasaKg, 60.848)
  assert.deepEqual(h.avisos, [])
  // Mujer 60 kg: Σ4 = 8 + 18 + 14 + 16 = 56; D = 1,1567 − 0,0717 log 56 = 1,03135; %G = 29,95 %
  const pliegues = { bicipital: 8, tricipital: 18, subescapular: 14, crestaIliaca: 16 }
  const m = resultado(durninWomersley({ ...hombre, sexo: 'F', pesoKg: 60, medidas: { ...medidas, pliegues } }))
  cerca(m.grasaPct, 29.951)
  cerca(m.grasaKg, 17.971)
  assert.match(resultado(durninWomersley({ ...hombre, edad: 15 })).avisos.join(), /17 a 72 años/)
})

// Evaluación 1 de la hoja EVAL de la ficha maestra (hombre de 30 años: la hoja tiene la edad en 0 y no la usa en estas masas)
const hoja: DatosAntropometria = {
  pesoKg: 76.5,
  tallaCm: 171,
  edad: 30,
  sexo: 'M',
  medidas: {
    basicos: { tallaSentado: 90.7 },
    pliegues: { bicipital: 3, tricipital: 7, subescapular: 10, crestaIliaca: 9, supraespinal: 7, abdominal: 13, musloFrontal: 10, pantorrilla: 7.5 },
    perimetros: {
      cabeza: 58.6,
      brazoRelajado: 32,
      brazoContraido: 33.5,
      antebrazo: 28,
      torax: 101.8,
      cintura: 85.3,
      cadera: 100.5,
      musloMaximo: 60.1,
      musloMedio: 56.7,
      pantorrilla: 35.4
    },
    diametros: { biacromial: 40.7, toraxTransverso: 30, toraxAnteroposterior: 21.3, biiliocrestideo: 26.6, humero: 6.5, femur: 9.4 },
    longitudes: {}
  }
}

test('Kerr: Z del Phantom de cada masa, como la hoja (ANT!O15:O18)', () => {
  const r = resultado(kerr(hoja))
  cerca(r.z.adiposa, -1.78705)
  cerca(r.z.muscular, 2.77111)
  cerca(r.z.residual, 3.11117)
  cerca(r.z.osea, -0.04788)
  cerca(r.adiposa.kg, 15.11293)
  cerca(r.muscular.kg, 39.37842)
})

test('sumatorias de pliegues de la hoja', () => {
  assert.deepEqual(sumaPliegues(hoja.medidas, PLIEGUES_6), { mm: 54.5 })
  assert.deepEqual(sumaPliegues(hoja.medidas, PLIEGUES_8), { mm: 66.5 })
})

test('somatotipo Heath-Carter: igual que la hoja (EVAL!B124:B129)', () => {
  const r = resultado(somatotipo(hoja))
  cerca(r.endo, 2.37864)
  cerca(r.meso, 5.07045)
  cerca(r.ecto, 1.02075) // la hoja usa peso^0,33333 en vez de ^(1/3): ±0,002
  cerca(r.x, -1.3579)
  cerca(r.y, 6.74151)
})

test('somatotipo: ectomorfia mínima 0,1 con índice altura-peso ≤ 38,25 e informa lo que falta', () => {
  assert.equal(resultado(somatotipo({ ...hoja, pesoKg: 120 })).ecto, 0.1) // 171 / 120^(1/3) = 34,7
  assert.deepEqual(somatotipo({ ...hoja, medidas: { ...hoja.medidas, diametros: { humero: 6.5 } } }), {
    faltan: ['fémur (biepicondilar) (diámetros)']
  })
})

test('perfil Phantom: Z de cada medida y de la composición', () => {
  const perfil = perfilPhantom(hoja)
  const z = (grupo: string, nombre: string) => perfil.find((g) => g.titulo === grupo)!.puntos.find((p) => p.nombre === nombre)!.z
  cerca(z('Pliegues', 'Tricipital'), -1.8867, 0.001) // hoja ANT!T29: (7 × 170,18/171 − 15,4)/4,47
  cerca(z('Perímetros', 'Cabeza'), 1.61041, 0.001)
  cerca(z('Perímetros', 'Muslo medio'), 0.7079, 0.001) // la hoja da 0,7675 por no escalar la medida (S39)
  cerca(z('Composición corporal', 'Peso'), 1.25869, 0.001)
  cerca(z('Composición corporal', 'Masa adiposa'), -1.78705, 0.001)
  assert.equal(perfil.find((g) => g.titulo === 'Pliegues')!.puntos.length, 6) // bicipital y cresta ilíaca no tienen Phantom
  assert.deepEqual(
    perfilPhantom({ ...hoja, medidas: medidasVacias() }).map((g) => g.titulo),
    ['Composición corporal']
  )
})

test('bicompartimental: grasa Durnin-Womersley y músculo 0,56 × masa libre de grasa, como la hoja (EVAL!B153:B166)', () => {
  const r = resultado(bicompartimental(hoja))
  cerca(r.grasa.pct, 13.61442)
  cerca(r.grasa.kg, 10.41503)
  cerca(r.muscular.kg, 37.00758)
  cerca(r.muscular.pct, 48.37592)
  cerca(r.residual.kg, 29.07739)
  cerca(r.grasa.kg + r.muscular.kg + r.residual.kg, 76.5)
})

test('bicompartimental: músculo por Lee con el paréntesis bien puesto', () => {
  // (1,71 m)(0,00744 · 29,8009² + 0,00088 · 56,9584² + 0,00441 · 33,0438²) + 2,4 − 0,048 · 30 + 7,8 = 33,175 kg
  // (la hoja da 45,5 por multiplicar todo el paréntesis por 2,4)
  cerca(resultado(bicompartimental(hoja, 'lee')).muscular.kg, 33.1747)
  // Mujer: sin el término de sexo
  cerca(resultado(bicompartimental({ ...hoja, sexo: 'F' }, 'lee')).muscular.kg, 30.7747)
  assert.deepEqual(bicompartimental({ ...hoja, medidas: { ...hoja.medidas, perimetros: {} } }, 'lee'), {
    faltan: ['brazo relajado (perímetros)', 'muslo máximo (1 cm bajo el glúteo) (perímetros)', 'pantorrilla (perímetros)']
  })
  assert.match(resultado(bicompartimental({ ...hoja, edad: 15 }, 'lee')).avisos.join(), /Lee/)
})

test('bicompartimental: avisa si el músculo supera la masa libre de grasa', () => {
  const grande = { ...hoja.medidas, perimetros: { ...hoja.medidas.perimetros, brazoRelajado: 60, musloMaximo: 90 } }
  const r = resultado(bicompartimental({ ...hoja, medidas: grande }, 'lee'))
  assert.ok(r.residual.kg < 0)
  assert.match(r.avisos.join(), /supera la masa libre de grasa/)
})
