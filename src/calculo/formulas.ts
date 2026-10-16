// Catálogo de fórmulas de gasto basal (TMB, kcal/día). Funciones puras, sin Electron ni base de datos.
// Para agregar una: definición + fuente + casos calculados a mano en test/gasto.test.ts.
// Si cambia un coeficiente, sube `version`: los controles guardan id y versión de lo que usaron.

export type Sexo = 'F' | 'M'

export type DatosPaciente = {
  pesoKg: number
  tallaCm?: number
  edad: number // años cumplidos a la fecha del control
  sexo: Sexo
  masaLibreGrasaKg?: number
}

export const NOMBRE_DATO: Record<keyof DatosPaciente, string> = {
  pesoKg: 'peso',
  tallaCm: 'talla',
  edad: 'edad',
  sexo: 'sexo',
  masaLibreGrasaKg: 'masa libre de grasa'
}

export interface FormulaGastoBasal {
  id: string
  version: number
  nombre: string
  poblacion: { edadMin?: number; edadMax?: number; descripcion: string }
  requiere: (keyof DatosPaciente)[]
  fuente: string
  calcular(d: DatosPaciente): number
}

// Ecuaciones de Schofield (solo peso) adoptadas por FAO/WHO/UNU 2004. [edad desde, a, b]: TMB = a × peso + b
const SCHOFIELD: Record<Sexo, [number, number, number][]> = {
  M: [[0, 59.512, -30.4], [3, 22.706, 504.3], [10, 17.686, 658.2], [18, 15.057, 692.2], [30, 11.472, 873.1], [60, 11.711, 587.7]],
  F: [[0, 58.317, -31.1], [3, 20.315, 485.9], [10, 13.384, 692.6], [18, 14.818, 486.6], [30, 8.126, 845.6], [60, 9.082, 658.5]]
}

export const FORMULAS: FormulaGastoBasal[] = [
  {
    id: 'mifflin-st-jeor',
    version: 1,
    nombre: 'Mifflin-St Jeor',
    poblacion: { edadMin: 19, edadMax: 78, descripcion: 'adultos de 19 a 78 años' },
    requiere: ['pesoKg', 'tallaCm', 'edad', 'sexo'],
    fuente:
      'Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-7.',
    calcular: ({ pesoKg, tallaCm, edad, sexo }) => 10 * pesoKg + 6.25 * tallaCm! - 5 * edad + (sexo === 'M' ? 5 : -161)
  },
  {
    id: 'fao-oms-unu-schofield',
    version: 1,
    nombre: 'FAO/OMS/UNU (Schofield)',
    poblacion: { edadMin: 0, descripcion: 'todas las edades' },
    requiere: ['pesoKg', 'edad', 'sexo'],
    fuente: 'FAO/WHO/UNU. Human energy requirements. Food and Nutrition Technical Report Series 1. Roma; 2004. Ecuaciones de Schofield (1985).',
    calcular: ({ pesoKg, edad, sexo }) => {
      const [, a, b] = SCHOFIELD[sexo].findLast(([desde]) => edad >= desde)!
      return a * pesoKg + b
    }
  },
  {
    id: 'harris-benedict-1919',
    version: 1,
    nombre: 'Harris-Benedict (1919)',
    poblacion: { edadMin: 15, edadMax: 74, descripcion: 'adultos sanos (muestra original de 15 a 74 años)' },
    requiere: ['pesoKg', 'tallaCm', 'edad', 'sexo'],
    fuente: 'Harris JA, Benedict FG. A biometric study of basal metabolism in man. Washington DC: Carnegie Institution of Washington; 1919. Publ. 279.',
    calcular: ({ pesoKg, tallaCm, edad, sexo }) =>
      sexo === 'M'
        ? 66.473 + 13.7516 * pesoKg + 5.0033 * tallaCm! - 6.755 * edad
        : 655.0955 + 9.5634 * pesoKg + 1.8496 * tallaCm! - 4.6756 * edad
  },
  {
    id: 'cunningham-1980',
    version: 1,
    nombre: 'Cunningham (1980)',
    poblacion: { edadMin: 18, descripcion: 'adultos' },
    requiere: ['masaLibreGrasaKg'],
    fuente: 'Cunningham JJ. A reanalysis of the factors influencing basal metabolic rate in normal adults. Am J Clin Nutr. 1980;33(11):2372-4.',
    calcular: ({ masaLibreGrasaKg }) => 500 + 22 * masaLibreGrasaKg!
  }
]

export function faltantes(f: FormulaGastoBasal, d: DatosPaciente): string[] {
  return f.requiere.filter((campo) => d[campo] === undefined).map((campo) => NOMBRE_DATO[campo])
}
