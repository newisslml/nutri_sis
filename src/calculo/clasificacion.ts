// Clasificaciones e indicadores del informe antropométrico. Umbrales de la hoja FORMS de la ficha maestra.
// Funciones puras; devuelven null cuando la tabla no aplica a la edad (niños y adolescentes necesitan curvas de crecimiento).
import type { Sexo } from './formulas.ts'

/** Semáforo para colorear: ok = en rango, atencion = fuera de rango sin riesgo grave, riesgo = requiere intervención. */
export type Nivel = 'ok' | 'atencion' | 'riesgo'
export type Clasificacion = { etiqueta: string; nivel: Nivel }

/** Tramo del valor: cada corte pertenece al tramo de arriba. */
const por = (valor: number, cortes: number[], tramos: Clasificacion[]): Clasificacion => tramos[cortes.filter((c) => valor >= c).length]

/** Estado nutricional por IMC (OMS); desde los 65 años, los puntos de corte de la hoja para adultos mayores. */
export function estadoNutricional(imc: number, edad: number): Clasificacion | null {
  if (edad < 18) return null
  if (edad >= 65) {
    return por(imc, [19, 23, 28, 32], [
      { etiqueta: 'Desnutrido', nivel: 'riesgo' },
      { etiqueta: 'Enflaquecido', nivel: 'atencion' },
      { etiqueta: 'Normal', nivel: 'ok' },
      { etiqueta: 'Sobrepeso', nivel: 'atencion' },
      { etiqueta: 'Obesidad', nivel: 'riesgo' }
    ])
  }
  return por(imc, [18.5, 25, 30, 35, 40], [
    { etiqueta: 'Enflaquecido', nivel: 'atencion' },
    { etiqueta: 'Normal', nivel: 'ok' },
    { etiqueta: 'Sobrepeso', nivel: 'atencion' },
    { etiqueta: 'Obesidad I', nivel: 'riesgo' },
    { etiqueta: 'Obesidad II', nivel: 'riesgo' },
    { etiqueta: 'Obesidad III', nivel: 'riesgo' }
  ])
}

/** Riesgo cardiovascular por perímetro de cintura (OMS): hombres 94 y 102 cm, mujeres 80 y 88 cm. */
export function riesgoCardiovascular(cinturaCm: number, sexo: Sexo, edad: number): Clasificacion | null {
  if (edad < 18) return null
  return por(cinturaCm, sexo === 'M' ? [94, 102] : [80, 88], [
    { etiqueta: 'Normal', nivel: 'ok' },
    { etiqueta: 'Elevado', nivel: 'atencion' },
    { etiqueta: 'Muy elevado', nivel: 'riesgo' }
  ])
}

/** Peso de referencia de la hoja: IMC 23 en hombres y 21,5 en mujeres. */
export const pesoIdealKg = (tallaCm: number, sexo: Sexo) => (tallaCm / 100) ** 2 * (sexo === 'M' ? 23 : 21.5)

export type ClasificacionConCortes = Clasificacion & { cortes: number[]; etiquetas: string[]; niveles: Nivel[] }

const NIVELES_GRASA: Nivel[] = ['atencion', 'ok', 'atencion', 'riesgo']
const ETIQUETAS_GRASA = ['Baja', 'Normal', 'Alta', 'Obesidad']
// [menor de 40 años, 40 a 59, 60 o más] → cortes entre Baja/Normal, Normal/Alta, Alta/Obesidad (% de grasa)
const CORTES_GRASA: Record<Sexo, number[][]> = {
  F: [[21, 33, 39], [23, 35, 40], [24, 36, 42]],
  M: [[8, 19, 25], [11, 22, 27], [13, 25, 30]]
}

/** Clasificación del % de grasa por sexo y edad; la hoja la define desde los 16 años. */
export function clasificarGrasa(pct: number, edad: number, sexo: Sexo): ClasificacionConCortes | null {
  if (edad <= 15) return null
  const cortes = CORTES_GRASA[sexo][edad < 40 ? 0 : edad < 60 ? 1 : 2]
  const i = cortes.filter((c) => pct >= c).length
  return { etiqueta: ETIQUETAS_GRASA[i], nivel: NIVELES_GRASA[i], cortes, etiquetas: ETIQUETAS_GRASA, niveles: NIVELES_GRASA }
}

const NIVELES_MUSCULO: Nivel[] = ['riesgo', 'atencion', 'ok', 'ok']
const ETIQUETAS_MUSCULO = ['Bajo', 'Normal', 'Bueno', 'Excelente']
const CORTES_MUSCULO: Record<Sexo, number[]> = { F: [36.4, 43.8, 47.5], M: [44, 50.8, 54.2] }

/** Clasificación del % de masa muscular por sexo; el valor en un corte pertenece al tramo inferior, como en la hoja. */
export function clasificarMusculo(pct: number, sexo: Sexo): ClasificacionConCortes {
  const cortes = CORTES_MUSCULO[sexo]
  const i = cortes.filter((c) => pct > c).length
  return { etiqueta: ETIQUETAS_MUSCULO[i], nivel: NIVELES_MUSCULO[i], cortes, etiquetas: ETIQUETAS_MUSCULO, niveles: NIVELES_MUSCULO }
}
