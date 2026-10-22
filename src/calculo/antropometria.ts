// Antropometría: sitios de medición (los de la hoja EVAL de la ficha maestra, perfil completo ISAK) y composición corporal.
// Funciones puras, sin Electron ni base de datos. Cada ecuación con su fuente y casos en test/antropometria.test.ts.
import type { Sexo } from './formulas.ts'

export const GRUPOS = {
  basicos: { titulo: 'Básicos', unidad: 'cm', max: 250, sitios: { tallaSentado: 'Talla sentado', envergadura: 'Envergadura' } },
  pliegues: {
    titulo: 'Pliegues',
    unidad: 'mm',
    max: 100,
    sitios: {
      tricipital: 'Tricipital',
      subescapular: 'Subescapular',
      bicipital: 'Bicipital',
      crestaIliaca: 'Cresta ilíaca (suprailíaco)',
      supraespinal: 'Supraespinal',
      abdominal: 'Abdominal',
      musloFrontal: 'Muslo frontal',
      pantorrilla: 'Pantorrilla medial'
    }
  },
  perimetros: {
    titulo: 'Perímetros',
    unidad: 'cm',
    max: 250,
    sitios: {
      cabeza: 'Cabeza',
      cuello: 'Cuello',
      brazoRelajado: 'Brazo relajado',
      brazoContraido: 'Brazo contraído',
      antebrazo: 'Antebrazo',
      muneca: 'Muñeca',
      torax: 'Tórax mesoesternal',
      cintura: 'Cintura',
      cadera: 'Cadera',
      musloMaximo: 'Muslo máximo (1 cm bajo el glúteo)',
      musloMedio: 'Muslo medio',
      pantorrilla: 'Pantorrilla',
      tobillo: 'Tobillo'
    }
  },
  diametros: {
    titulo: 'Diámetros',
    unidad: 'cm',
    max: 80,
    sitios: {
      biacromial: 'Biacromial',
      toraxTransverso: 'Tórax transverso',
      toraxAnteroposterior: 'Tórax anteroposterior',
      biiliocrestideo: 'Bi-iliocrestídeo',
      humero: 'Húmero (biepicondilar)',
      femur: 'Fémur (biepicondilar)',
      muneca: 'Muñeca (biestiloideo)',
      tobillo: 'Tobillo (bimaleolar)',
      mano: 'Mano'
    }
  },
  longitudes: {
    titulo: 'Longitudes y segmentos',
    unidad: 'cm',
    max: 150,
    sitios: {
      acromialRadial: 'Acromial-radial',
      radialEstiloidea: 'Radial-estiloidea',
      estiloideaDactilar: 'Medial estiloidea-dactilar',
      ileospinal: 'Ileospinal',
      trocanterea: 'Trocantérea',
      trocantereaTibial: 'Trocantérea-tibial lateral',
      tibialLateral: 'Tibial lateral',
      tibialMaleolar: 'Tibial medial-maleolar medial',
      pie: 'Pie'
    }
  }
} as const

export type Grupo = keyof typeof GRUPOS
export type Sitio<G extends Grupo> = keyof (typeof GRUPOS)[G]['sitios']
export type Medidas = { [G in Grupo]: Partial<Record<Sitio<G>, number>> }
type Requisitos = { [G in Grupo]?: Sitio<G>[] }

export const medidasVacias = (): Medidas => ({ basicos: {}, pliegues: {}, perimetros: {}, diametros: {}, longitudes: {} })

/** Nombres de los sitios requeridos que no se han medido. */
export function faltanSitios(m: Medidas, requiere: Requisitos): string[] {
  return (Object.keys(requiere) as Grupo[]).flatMap((g) =>
    (requiere[g] as string[])
      .filter((s) => (m[g] as Record<string, number | undefined>)[s] === undefined)
      .map((s) => `${(GRUPOS[g].sitios as Record<string, string>)[s].toLowerCase()} (${GRUPOS[g].titulo.toLowerCase()})`)
  )
}

/** Sumatoria de pliegues (mm) o los sitios que faltan para calcularla. */
export function sumaPliegues(m: Medidas, sitios: Sitio<'pliegues'>[]): { mm: number } | { faltan: string[] } {
  const faltan = faltanSitios(m, { pliegues: sitios })
  return faltan.length ? { faltan } : { mm: sitios.reduce((s, x) => s + m.pliegues[x]!, 0) }
}
export const PLIEGUES_4: Sitio<'pliegues'>[] = ['bicipital', 'tricipital', 'subescapular', 'crestaIliaca']
export const PLIEGUES_6: Sitio<'pliegues'>[] = ['tricipital', 'subescapular', 'supraespinal', 'abdominal', 'musloFrontal', 'pantorrilla']
export const PLIEGUES_8 = Object.keys(GRUPOS.pliegues.sitios) as Sitio<'pliegues'>[]

export type DatosAntropometria = { pesoKg: number; tallaCm: number; edad: number; sexo: Sexo; medidas: Medidas }
export type Componente = { kg: number; pct: number }
export type ResultadoKerr = {
  adiposa: Componente
  muscular: Componente
  osea: Componente
  residual: Componente
  piel: Componente
  pesoEstructuradoKg: number // suma de masas antes del ajuste al peso real
  masaLibreGrasaKg: number
  z: { adiposa: number; muscular: number; osea: number; residual: number } // Z del Phantom con que se estimó cada masa (la ósea, de los diámetros del cuerpo)
}

const REQUIERE_KERR: Requisitos = {
  basicos: ['tallaSentado'],
  pliegues: PLIEGUES_6,
  perimetros: ['cabeza', 'brazoRelajado', 'antebrazo', 'torax', 'cintura', 'musloMaximo', 'pantorrilla'],
  diametros: ['biacromial', 'toraxTransverso', 'toraxAnteroposterior', 'biiliocrestideo', 'humero', 'femur']
}

/**
 * Fraccionamiento en 5 componentes (Kerr, 1988), igual que la hoja EVAL salvo dos correcciones:
 * perímetro corregido = perímetro − π × pliegue (la hoja usa 3,14) y constante de superficie 70,691 en menores de 12 años
 * (la hoja nunca la aplica). Cada masa se estima por proporcionalidad con el Phantom y luego se ajusta al peso real.
 * Fuente: Kerr DA. An anthropometric method for fractionation of skin, adipose, bone, muscle and residual tissue masses
 * in males and females age 6 to 77 years [tesis]. Simon Fraser University; 1988.
 */
export function kerr(d: DatosAntropometria): { resultado: ResultadoKerr } | { faltan: string[] } {
  const { basicos: b, pliegues: pl, perimetros: pe, diametros: di } = d.medidas
  const faltan = faltanSitios(d.medidas, REQUIERE_KERR)
  if (faltan.length) return { faltan }
  const corregido = (perimetroCm: number, plieguesMm: number) => perimetroCm - (Math.PI * plieguesMm) / 10
  const s = 170.18 / d.tallaCm // escala a la talla del Phantom
  const sr = 89.92 / b.tallaSentado! // escala a la talla sentado del Phantom
  const z = (suma: number, escala: number, media: number, de: number) => (suma * escala - media) / de
  const masa = (zScore: number, de: number, media: number, escala: number) => (zScore * de + media) / escala ** 3

  const zAdiposa = z(PLIEGUES_6.reduce((t, x) => t + pl[x]!, 0), s, 116.41, 34.79)
  const adiposa = masa(zAdiposa, 5.85, 25.6, s)
  const sumaMuscular =
    corregido(pe.brazoRelajado!, pl.tricipital!) +
    pe.antebrazo! +
    corregido(pe.torax!, pl.subescapular!) +
    corregido(pe.musloMaximo!, pl.musloFrontal!) +
    corregido(pe.pantorrilla!, pl.pantorrilla!)
  const zMuscular = z(sumaMuscular, s, 207.21, 13.74)
  const muscular = masa(zMuscular, 5.4, 24.5, s)
  const cabeza = ((pe.cabeza! - 56) / 1.44) * 0.18 + 1.2 // la cabeza no se escala por talla
  const zOsea = z(di.biacromial! + di.biiliocrestideo! + 2 * di.humero! + 2 * di.femur!, s, 98.88, 5.33)
  const cuerpo = masa(zOsea, 1.34, 6.7, s)
  const sumaTorax = di.toraxTransverso! + di.toraxAnteroposterior! + corregido(pe.cintura!, pl.abdominal!)
  const zResidual = z(sumaTorax, sr, 109.35, 7.08)
  const residual = masa(zResidual, 1.24, 6.1, sr)
  const constante = d.edad < 12 ? 70.691 : d.sexo === 'M' ? 68.308 : 73.074
  const superficieM2 = (constante * d.pesoKg ** 0.425 * d.tallaCm ** 0.725) / 10000
  const piel = superficieM2 * (d.sexo === 'M' ? 2.07 : 1.96) * 1.05 // grosor de piel (mm) × densidad

  const pesoEstructuradoKg = adiposa + muscular + cabeza + cuerpo + residual + piel
  const ajustar = (bruta: number): Componente => ({ kg: (bruta / pesoEstructuradoKg) * d.pesoKg, pct: (bruta / pesoEstructuradoKg) * 100 })
  const r = {
    adiposa: ajustar(adiposa),
    muscular: ajustar(muscular),
    osea: ajustar(cabeza + cuerpo),
    residual: ajustar(residual),
    piel: ajustar(piel)
  }
  return {
    resultado: {
      ...r,
      pesoEstructuradoKg,
      masaLibreGrasaKg: d.pesoKg - r.adiposa.kg,
      z: { adiposa: zAdiposa, muscular: zMuscular, osea: zOsea, residual: zResidual }
    }
  }
}

export type ResultadoDurnin = { densidad: number; grasaPct: number; grasaKg: number; masaLibreGrasaKg: number; avisos: string[] }

/**
 * Densidad corporal por Durnin y Womersley (ecuación general de 17 a 72 años, Σ4 pliegues) y % de grasa por Siri.
 * Fuentes: Durnin JV, Womersley J. Br J Nutr. 1974;32(1):77-97. Siri WE. Techniques for measuring body composition. 1961.
 */
export function durninWomersley(d: DatosAntropometria): { resultado: ResultadoDurnin } | { faltan: string[] } {
  const suma = sumaPliegues(d.medidas, PLIEGUES_4)
  if ('faltan' in suma) return suma
  const densidad = d.sexo === 'M' ? 1.1765 - 0.0744 * Math.log10(suma.mm) : 1.1567 - 0.0717 * Math.log10(suma.mm)
  const grasaPct = 495 / densidad - 450
  const grasaKg = (grasaPct / 100) * d.pesoKg
  const avisos = d.edad < 17 || d.edad > 72 ? ['Durnin-Womersley está validada de 17 a 72 años'] : []
  return { resultado: { densidad, grasaPct, grasaKg, masaLibreGrasaKg: d.pesoKg - grasaKg, avisos } }
}

export type MetodoMusculo = 'estimado' | 'lee'
export type ResultadoBi = { grasa: Componente; muscular: Componente; residual: Componente; avisos: string[] }

const REQUIERE_LEE: Requisitos = {
  pliegues: ['tricipital', 'musloFrontal', 'pantorrilla'],
  perimetros: ['brazoRelajado', 'musloMaximo', 'pantorrilla']
}

/**
 * Modelo de 3 masas: grasa (Durnin-Womersley + Siri), músculo y residual/óseo (lo que resta del peso).
 * Músculo "estimado" = 0,56 × masa libre de grasa, como la hoja EVAL. "lee" = ecuación de Lee et al. con perímetros
 * corregidos por pliegue, para raza blanca o hispana (término de raza 0); la hoja multiplica todo el paréntesis por 2,4
 * y usa 0,0044 en vez de 0,00441, aquí va como se publicó. Para el muslo usa el perímetro máximo, igual que la hoja.
 * Fuente: Lee RC et al. Am J Clin Nutr. 2000;72(3):796-803.
 */
export function bicompartimental(d: DatosAntropometria, metodo: MetodoMusculo = 'estimado'): { resultado: ResultadoBi } | { faltan: string[] } {
  const dw = durninWomersley(d)
  if ('faltan' in dw) return dw
  const { grasaKg, grasaPct, masaLibreGrasaKg } = dw.resultado
  const avisos = [...dw.resultado.avisos]
  let muscularKg = 0.56 * masaLibreGrasaKg
  if (metodo === 'lee') {
    const faltan = faltanSitios(d.medidas, REQUIERE_LEE)
    if (faltan.length) return { faltan }
    const { pliegues: pl, perimetros: pe } = d.medidas
    const corregido = (perimetroCm: number, plieguesMm: number) => perimetroCm - (Math.PI * plieguesMm) / 10
    const [brazo, muslo, pantorrilla] = [
      corregido(pe.brazoRelajado!, pl.tricipital!),
      corregido(pe.musloMaximo!, pl.musloFrontal!),
      corregido(pe.pantorrilla!, pl.pantorrilla!)
    ]
    muscularKg =
      (d.tallaCm / 100) * (0.00744 * brazo ** 2 + 0.00088 * muslo ** 2 + 0.00441 * pantorrilla ** 2) +
      2.4 * (d.sexo === 'M' ? 1 : 0) -
      0.048 * d.edad +
      7.8
    if (d.edad < 18) avisos.push('La ecuación de Lee está validada en adultos')
  }
  const residualKg = d.pesoKg - grasaKg - muscularKg
  if (residualKg < 0) avisos.push('La masa muscular supera la masa libre de grasa: revise las medidas')
  const componente = (kg: number): Componente => ({ kg, pct: (kg / d.pesoKg) * 100 })
  return { resultado: { grasa: { kg: grasaKg, pct: grasaPct }, muscular: componente(muscularKg), residual: componente(residualKg), avisos } }
}

export type ResultadoSomatotipo = { endo: number; meso: number; ecto: number; x: number; y: number }

const REQUIERE_SOMATOTIPO: Requisitos = {
  pliegues: ['tricipital', 'subescapular', 'supraespinal', 'pantorrilla'],
  perimetros: ['brazoContraido', 'pantorrilla'],
  diametros: ['humero', 'femur']
}

/**
 * Somatotipo antropométrico de Heath-Carter. Como la hoja EVAL, salvo ectomorfia con índice altura-peso ≤ 38,25, que vale 0,1
 * (la hoja sigue la recta del tramo anterior y puede dar negativa). Coordenadas de la somatocarta: x = ecto − endo, y = 2 meso − (endo + ecto).
 * Fuente: Carter JEL, Heath BH. Somatotyping: development and applications. Cambridge University Press; 1990.
 */
export function somatotipo(d: DatosAntropometria): { resultado: ResultadoSomatotipo } | { faltan: string[] } {
  const faltan = faltanSitios(d.medidas, REQUIERE_SOMATOTIPO)
  if (faltan.length) return { faltan }
  const { pliegues: pl, perimetros: pe, diametros: di } = d.medidas
  const tres = ((pl.tricipital! + pl.subescapular! + pl.supraespinal!) * 170.18) / d.tallaCm // 3 pliegues corregidos por talla
  const endo = -0.7182 + 0.1451 * tres - 0.00068 * tres ** 2 + 0.0000014 * tres ** 3
  const meso =
    0.858 * di.humero! +
    0.601 * di.femur! +
    0.188 * (pe.brazoContraido! - pl.tricipital! / 10) +
    0.161 * (pe.pantorrilla! - pl.pantorrilla! / 10) -
    0.131 * d.tallaCm +
    4.5
  const iap = d.tallaCm / d.pesoKg ** (1 / 3) // índice altura-peso
  const ecto = iap >= 40.75 ? 0.732 * iap - 28.58 : iap > 38.25 ? 0.463 * iap - 17.63 : 0.1
  return { resultado: { endo, meso, ecto, x: ecto - endo, y: 2 * meso - (endo + ecto) } }
}

// Phantom de Ross y Wilson (media y desviación estándar para 170,18 cm de talla), de la hoja EVAL de la ficha maestra.
const PHANTOM: { [G in Grupo]?: Partial<Record<Sitio<G>, readonly [number, number]>> } = {
  pliegues: {
    tricipital: [15.4, 4.47],
    subescapular: [17.2, 5.07],
    supraespinal: [15.4, 4.47],
    abdominal: [25.4, 7.78],
    musloFrontal: [27, 8.33],
    pantorrilla: [16, 4.67]
  },
  perimetros: {
    cabeza: [56, 1.44],
    brazoRelajado: [26.89, 2.33],
    brazoContraido: [29.41, 2.37],
    antebrazo: [25.13, 1.41],
    torax: [87.86, 5.18],
    cintura: [71.91, 4.45],
    cadera: [94.67, 5.58],
    musloMaximo: [55.82, 4.23],
    musloMedio: [53.2, 4.56],
    pantorrilla: [35.25, 2.3]
  },
  diametros: {
    biacromial: [38.04, 1.92],
    toraxTransverso: [27.92, 1.74],
    toraxAnteroposterior: [17.5, 1.38],
    biiliocrestideo: [28.84, 1.75],
    humero: [6.48, 0.35],
    femur: [9.52, 0.48]
  },
  basicos: { tallaSentado: [89.92, 4.5] }
}

export type PerfilPhantom = { titulo: string; puntos: { nombre: string; z: number }[] }[]

/**
 * Z de cada medida tomada contra el Phantom (medida × 170,18/talla), más el peso (× (170,18/talla)³) y las masas de Kerr.
 * La hoja EVAL calcula el Z del muslo medio con la medida sin escalar por talla (S39); aquí se escala como las demás.
 */
export function perfilPhantom(d: DatosAntropometria): PerfilPhantom {
  const s = 170.18 / d.tallaCm
  const medidas = (Object.keys(PHANTOM) as Grupo[]).map((g) => ({
    titulo: GRUPOS[g].titulo,
    puntos: Object.entries(PHANTOM[g] as Record<string, readonly [number, number]>).flatMap(([sitio, [media, de]]) => {
      const valor = (d.medidas[g] as Record<string, number | undefined>)[sitio]
      return valor === undefined ? [] : [{ nombre: (GRUPOS[g].sitios as Record<string, string>)[sitio], z: (valor * s - media) / de }]
    })
  }))
  const k = kerr(d)
  const masas = { adiposa: 'Masa adiposa', muscular: 'Masa muscular', residual: 'Masa residual', osea: 'Masa ósea' }
  const composicion = [
    { nombre: 'Peso', z: (d.pesoKg * s ** 3 - 64.58) / 8.6 },
    ...('faltan' in k ? [] : (Object.keys(masas) as (keyof typeof masas)[]).map((m) => ({ nombre: masas[m], z: k.resultado.z[m] })))
  ]
  return [...medidas.filter((g) => g.puntos.length), { titulo: 'Composición corporal', puntos: composicion }]
}
