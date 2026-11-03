// Clasificaciones e indicadores del informe antropométrico. Umbrales de la hoja FORMS de la ficha maestra.
// Funciones puras; devuelven null cuando la tabla no aplica a la edad (niños y adolescentes necesitan curvas de crecimiento).
import type { Sexo } from './formulas.ts'

/** Semáforo para colorear: ok = en rango, atencion = fuera de rango sin riesgo grave, riesgo = requiere intervención. */
export type Nivel = 'ok' | 'atencion' | 'riesgo'
export type Clasificacion = { etiqueta: string; nivel: Nivel }

/** Tramo del valor: cada corte pertenece al tramo de arriba. */
const por = (valor: number, cortes: number[], tramos: Clasificacion[]): Clasificacion => tramos[cortes.filter((c) => valor >= c).length]

// Atalah 1997, tabla MINSAL 2018-2019 (tarjeta #46 de Trello): IMC desde el que empieza normal, sobrepeso y obesidad, semanas 6 a 42.
const ATALAH = [
  [18.5, 25, 30.1], [18.6, 25, 30.1], [18.7, 25.1, 30.2], [18.8, 25.2, 30.2], [18.9, 25.3, 30.3], [19, 25.4, 30.3], [19.1, 25.5, 30.4],
  [19.2, 25.6, 30.4], [19.3, 25.7, 30.5], [19.4, 25.8, 30.5], [19.5, 25.9, 30.6], [19.6, 26, 30.6], [19.7, 26.1, 30.7], [19.8, 26.2, 30.7],
  [20, 26.3, 30.8], [20.2, 26.4, 30.9], [20.4, 26.5, 31], [20.6, 26.6, 31.1], [20.8, 26.8, 31.2], [21, 26.9, 31.3], [21.2, 27, 31.4],
  [21.4, 27.1, 31.5], [21.6, 27.2, 31.6], [21.8, 27.3, 31.7], [22, 27.4, 31.8], [22.2, 27.5, 31.9], [22.3, 27.6, 32], [22.4, 27.7, 32.1],
  [22.5, 27.8, 32.2], [22.6, 27.9, 32.3], [22.7, 28, 32.4], [22.8, 28.1, 32.5], [22.9, 28.2, 32.6], [23, 28.3, 32.7], [23.1, 28.4, 32.8],
  [23.2, 28.5, 32.9], [23.3, 28.6, 33]
]

/** Las tablas de gestantes y adultos mayores vienen con un decimal: 23,04 se lee 23,0. */
const unDecimal = (imc: number) => Math.round(imc * 10) / 10

/**
 * Estado nutricional por IMC (OMS). En gestación, la curva de Atalah por semana (null fuera de las semanas 6 a 42).
 * Desde los 65 años, los cortes del adulto mayor que confirmó Fabi (tarjeta #47).
 */
export function estadoNutricional(imc: number, edad: number, semanaEmbarazo?: number | null): Clasificacion | null {
  if (semanaEmbarazo) {
    const cortes = ATALAH[semanaEmbarazo - 6]
    return cortes
      ? por(unDecimal(imc), cortes, [
          { etiqueta: 'Bajo peso', nivel: 'atencion' },
          { etiqueta: 'Normal', nivel: 'ok' },
          { etiqueta: 'Sobrepeso', nivel: 'atencion' },
          { etiqueta: 'Obesidad', nivel: 'riesgo' }
        ])
      : null
  }
  if (edad < 18) return null
  if (edad >= 65) {
    return por(unDecimal(imc), [23.1, 28, 32], [
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
