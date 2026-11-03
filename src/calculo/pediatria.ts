// Evaluación nutricional de 0 a 19 años: puntaje z con las tablas LMS de la OMS (oms.ts) y la calificación de la norma
// "Patrones de crecimiento para la evaluación nutricional de niños, niñas y adolescentes, desde el nacimiento a 19 años"
// (MINSAL, 2018). Funciones puras; desde los 19 años 1 mes devuelven null y rigen las clasificaciones de adulto.
import type { Clasificacion } from './clasificacion.ts'
import type { Sexo } from './formulas.ts'
import { CEFALICO_EDAD, ESTATURA_EDAD, IMC_EDAD, LONGITUD_EDAD, PESO_EDAD, PESO_ESTATURA, PESO_LONGITUD, type LMS, type TablaLMS } from './oms.ts'

/** Meses cumplidos y días sobre el último mes cumplido (fechas YYYY-MM-DD). Nacido un 31, el mes se cumple el último día de los meses cortos. */
export function edadMesesDias(nacimiento: string, fecha: string) {
  const [na, nm, nd] = nacimiento.split('-').map(Number)
  const [aa, am, ad] = fecha.split('-').map(Number)
  const meses = (aa - na) * 12 + (am - nm) - (ad < nd ? 1 : 0)
  const dias = ad >= nd ? ad - nd : Math.max(0, new Date(Date.UTC(aa, am - 1, 0)).getUTCDate() - nd) + ad
  return { meses, dias }
}

const zLMS = ([l, m, s]: LMS, y: number) => ((y / m) ** l - 1) / (l * s)

/** Puntaje z de los indicadores de peso: sobre ±3 DE la OMS mide la distancia con el ancho entre 2 y 3 DE (software Anthro). */
function zAjustado(lms: LMS, y: number) {
  const z = zLMS(lms, y)
  if (Math.abs(z) <= 3) return z
  const [l, m, s] = lms
  const de = (k: number) => m * (1 + l * s * k) ** (1 / l)
  return z > 3 ? 3 + (y - de(3)) / (de(3) - de(2)) : -3 + (y - de(-3)) / (de(-2) - de(-3))
}

/** Fila de la tabla para x; entre filas (peso para la talla, cada 0,1 cm) interpola L, M y S como Anthro. Fuera de rango, null. */
function fila(t: TablaLMS, sexo: Sexo, x: number): LMS | null {
  const filas = t[sexo]
  const i = Math.round(((x - t.desde) / t.paso) * 1e6) / 1e6
  if (i < 0 || i > filas.length - 1) return null
  const a = Math.floor(i)
  if (a === i) return filas[a]
  const [bajo, alto] = [filas[a], filas[a + 1]]
  return [0, 1, 2].map((k) => bajo[k] + (i - a) * (alto[k] - bajo[k])) as unknown as LMS
}

/** Tramo de la norma: -2 y -1 DE pertenecen al tramo de abajo; +1, +2 y +3 DE, al de arriba. */
const tramo = (z: number) => (z <= -2 ? 0 : z <= -1 ? 1 : z < 1 ? 2 : z < 2 ? 3 : z < 3 ? 4 : 5)

const NUTRICIONAL: Clasificacion[] = [
  { etiqueta: 'Desnutrición', nivel: 'riesgo' },
  { etiqueta: 'Riesgo de desnutrir', nivel: 'atencion' },
  { etiqueta: 'Normal', nivel: 'ok' },
  { etiqueta: 'Sobrepeso', nivel: 'atencion' },
  { etiqueta: 'Obesidad', nivel: 'riesgo' },
  { etiqueta: 'Obesidad severa', nivel: 'riesgo' } // solo IMC/E, desde 5 años 1 mes
]
const ESTATURAL: Clasificacion[] = [
  { etiqueta: 'Talla baja', nivel: 'riesgo' },
  { etiqueta: 'Talla normal baja', nivel: 'ok' },
  { etiqueta: 'Normal', nivel: 'ok' },
  { etiqueta: 'Talla normal alta', nivel: 'ok' },
  { etiqueta: 'Talla alta', nivel: 'atencion' },
  { etiqueta: 'Talla alta', nivel: 'atencion' }
]

// Percentiles 75 y 90 de cintura (cm) de 5 a 18 años (Fernández et al. J Pediatr 2004), como los publica la norma.
// Niñas de 10 años: la norma imprime p75 = 58,7, fuera de la serie (66,3 a los 9 y 71,1 a los 11); se usa 68,7.
const CINTURA: Record<Sexo, [p75: number, p90: number][]> = {
  F: [[56.7, 61.4], [59.1, 64.1], [61.5, 67.5], [63.9, 70.5], [66.3, 73.6], [68.7, 76.6], [71.1, 79.7], [73.5, 82.7], [75.9, 85.9], [78.3, 88.8], [80.7, 91.9], [83.1, 94.9], [85.5, 98], [87.9, 101]],
  M: [[56.4, 61], [59, 64.4], [61.5, 67.8], [64.1, 71.2], [66.6, 74.6], [69.2, 78], [71.7, 81.4], [74.3, 84.4], [76.8, 88.2], [79.4, 91.6], [81.9, 95], [84.5, 98.4], [87, 101.8], [89.6, 105.2]]
}

/**
 * Edad para las curvas. Prematuros (bajo 37 semanas): edad corregida = cronológica − (40 − semanas) × 7 días, hasta los 24 meses
 * corregidos en los extremos (bajo 32 semanas o 1.500 g) y hasta los 12 en moderados y tardíos (Norma Técnica 0 a 9 años, MINSAL 2014).
 */
function edadParaCurvas(d: DatosPediatricos) {
  const real = edadMesesDias(d.nacimiento, d.fecha)
  const s = d.semanasGestacion
  if (!s || s >= 37) return { ...real, corregida: false }
  const [a, m, dia] = d.nacimiento.split('-').map(Number)
  const termino = new Date(Date.UTC(a, m - 1, dia + (40 - s) * 7)).toISOString().slice(0, 10)
  const corregida = edadMesesDias(termino, d.fecha)
  const extremo = s < 32 || (d.pesoNacerG ?? Infinity) < 1500
  return corregida.meses < (extremo ? 24 : 12) ? { ...corregida, corregida: true } : { ...real, corregida: false }
}

/** Edad talla: el mes en que la talla es la mediana. Una longitud equivale a la estatura + 0,7 cm (OMS), para cruzar los 24 meses. */
function edadTalla(sexo: Sexo, tallaCm: number, acostado: boolean) {
  const comoLongitud = acostado ? tallaCm : tallaCm + 0.7
  const medianas = [...LONGITUD_EDAD[sexo].slice(0, 24).map((f) => f[1]), ...ESTATURA_EDAD[sexo].map((f) => f[1] + 0.7)]
  return medianas.reduce((mejor, m, i) => (Math.abs(m - comoLongitud) < Math.abs(medianas[mejor] - comoLongitud) ? i : mejor), 0)
}

export type Indicador = { sigla: string; nombre: string; z: number }
export type DatosPediatricos = {
  sexo: Sexo
  nacimiento: string
  fecha: string
  pesoKg: number
  tallaCm: number // longitud (acostado) bajo 2 años, estatura desde los 2
  cabezaCm?: number
  cinturaCm?: number
  semanasGestacion?: number | null // al nacer; bajo 37 se usa la edad corregida
  pesoNacerG?: number | null
}
export type EvaluacionPediatrica = {
  edadCorregidaMeses: number | null // meses cumplidos de edad corregida, cuando se aplica
  indicadores: Indicador[]
  nutricional: Clasificacion | null // null si la talla queda fuera de la tabla de peso para la talla
  estatural: Clasificacion
  cefalico: Clasificacion | null // con perímetro de cabeza, hasta los 5 años (la norma lo exige hasta los 3)
  cintura: Clasificacion | null // con perímetro de cintura, de 5 a 18 años
  pesoIdeal: { kg: number; segun: 'P/T' | 'IMC/E' } | null // null si la talla queda fuera de la tabla P/T
}

export function evaluarPediatria(d: DatosPediatricos): EvaluacionPediatrica | null {
  const { meses, dias, corregida } = edadParaCurvas(d)
  if (meses < 0 || meses > 228) return null // un prematuro antes de las 40 semanas corregidas necesita curvas neonatales
  // Bajo 5 años, 16 días o más se aproximan al mes siguiente; desde ahí se usa el mes cumplido.
  const mes = meses < 60 && dias >= 16 ? meses + 1 : meses
  const acostado = meses < 24
  const z = (t: TablaLMS, x: number, y: number, ajustado: boolean) => {
    const f = fila(t, d.sexo, x)
    return f && Math.round((ajustado ? zAjustado(f, y) : zLMS(f, y)) * 100) / 100 + 0 // + 0: sin -0
  }
  const tablaPT = acostado ? PESO_LONGITUD : PESO_ESTATURA
  const pe = z(PESO_EDAD, mes, d.pesoKg, true)
  const te = z(acostado ? LONGITUD_EDAD : ESTATURA_EDAD, mes, d.tallaCm, false)!
  const pt = meses <= 60 ? z(tablaPT, d.tallaCm, d.pesoKg, true) : null
  const imc = meses > 60 ? z(IMC_EDAD, mes, d.pesoKg / (d.tallaCm / 100) ** 2, true) : null
  // Con talla alta o baja, el perímetro cefálico se evalúa a la edad talla.
  const mesCefalico = te <= -2 || te >= 2 ? edadTalla(d.sexo, d.tallaCm, acostado) : mes
  const pce = d.cabezaCm === undefined ? null : z(CEFALICO_EDAD, mesCefalico, d.cabezaCm, false)
  // Peso ideal: la mediana de P/T hasta los 5 años; después, el IMC/E de la mediana por la talla al cuadrado.
  const pesoIdeal = meses <= 60 ? fila(tablaPT, d.sexo, d.tallaCm)?.[1] : fila(IMC_EDAD, d.sexo, mes)![1] * (d.tallaCm / 100) ** 2

  // Bajo 1 año califica P/E (sin sobrepeso), salvo que P/T sea ≥ +1 DE; de 1 a 5 años 29 días, P/T; después, IMC/E.
  const nutricional =
    meses < 12
      ? pt !== null && pt >= 1
        ? NUTRICIONAL[Math.min(tramo(pt), 4)]
        : NUTRICIONAL[Math.min(tramo(pe!), 2)]
      : meses <= 60
        ? pt === null
          ? null
          : NUTRICIONAL[Math.min(tramo(pt), 4)]
        : NUTRICIONAL[tramo(imc!)]

  const t = pce === null ? null : tramo(pce)
  const anios = Math.floor(meses / 12)
  const p = d.cinturaCm !== undefined && anios >= 5 ? CINTURA[d.sexo][anios - 5] : undefined
  return {
    edadCorregidaMeses: corregida ? meses : null,
    indicadores: (
      [
        ['P/E', 'Peso para la edad', pe],
        ['T/E', acostado ? 'Longitud para la edad' : 'Estatura para la edad', te],
        ['P/T', acostado ? 'Peso para la longitud' : 'Peso para la estatura', pt],
        ['IMC/E', 'IMC para la edad', imc],
        ['PCe/E', mesCefalico === mes ? 'Perímetro cefálico para la edad' : `Perímetro cefálico a la edad talla (${mesCefalico} meses)`, pce]
      ] as const
    ).flatMap(([sigla, nombre, z]) => (z === null ? [] : [{ sigla, nombre, z }])),
    pesoIdeal: pesoIdeal === undefined ? null : { kg: pesoIdeal, segun: meses <= 60 ? 'P/T' : 'IMC/E' },
    nutricional,
    estatural: ESTATURAL[tramo(te)],
    cefalico:
      t === null
        ? null
        : t === 0
          ? { etiqueta: 'Microcefalia', nivel: 'riesgo' }
          : t >= 4
            ? { etiqueta: 'Macrocefalia', nivel: 'riesgo' }
            : { etiqueta: 'Normal', nivel: 'ok' },
    cintura:
      p === undefined
        ? null
        : d.cinturaCm! >= p[1]
          ? { etiqueta: 'Obesidad abdominal', nivel: 'riesgo' }
          : d.cinturaCm! >= p[0]
            ? { etiqueta: 'Riesgo de obesidad abdominal', nivel: 'atencion' }
            : { etiqueta: 'Normal', nivel: 'ok' }
  }
}
