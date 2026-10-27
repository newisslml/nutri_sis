// Porciones de intercambio y requerimientos por día (hoja 24H-REQ de la ficha maestra). Funciones puras.
// Valores por porción de la hoja FORMS (F1:J16 y M57:P59). Si cambia uno, sube VERSION_INTERCAMBIO.
// ponytail: catálogo fijo en código; pasa a Configuración (tarjeta #21) y se congela por control cuando Fabi lo edite.

export type Macros = { kcal: number; cho: number; lip: number; prot: number }

export const VERSION_INTERCAMBIO = 1

// Los 13 códigos de la planificación del Excel (24H-REQ S69:S81). Leguminosas van en CER o CBG, como en la hoja PLAN.
export const GRUPOS_INTERCAMBIO = {
  CER: { nombre: 'Cereales, tubérculos y leguminosas', kcal: 140, cho: 30, lip: 1, prot: 3 },
  VG: { nombre: 'Verduras de consumo general', kcal: 30, cho: 5, lip: 0, prot: 2 },
  VLC: { nombre: 'Verduras de libre consumo', kcal: 10, cho: 2.5, lip: 0, prot: 0 },
  FRT: { nombre: 'Frutas', kcal: 65, cho: 15, lip: 0, prot: 1 },
  CBG: { nombre: 'Carnes y proteicos bajos en grasa', kcal: 65, cho: 1, lip: 2, prot: 11 },
  LAG: { nombre: 'Lácteos altos en grasa', kcal: 110, cho: 9, lip: 6, prot: 5 },
  LMG: { nombre: 'Lácteos medios en grasa', kcal: 85, cho: 9, lip: 3, prot: 5 },
  LBG: { nombre: 'Lácteos bajos en grasa', kcal: 70, cho: 10, lip: 0, prot: 7 },
  // FORMS trae 180 kcal por 4 cucharaditas y la hoja divide la planificación por 4: aquí la porción es 1 cucharadita.
  AC: { nombre: 'Aceites y grasas', kcal: 45, cho: 0, lip: 5, prot: 0 },
  ARL: { nombre: 'Alimentos ricos en lípidos', kcal: 175, cho: 5, lip: 15, prot: 5 },
  AZ: { nombre: 'Azúcares', kcal: 20, cho: 5, lip: 0, prot: 0 },
  INT: { nombre: 'Intraentrenamiento', kcal: 120, cho: 30, lip: 0, prot: 0 },
  EX: { nombre: 'Extra', kcal: 174, cho: 20, lip: 10, prot: 1 }
} satisfies Record<string, Macros & { nombre: string }>

export type CodigoGrupo = keyof typeof GRUPOS_INTERCAMBIO
export const CODIGOS = Object.keys(GRUPOS_INTERCAMBIO) as CodigoGrupo[]
export type Porciones = Partial<Record<CodigoGrupo, number>>

/** Tiempos de comida de la ficha maestra (FORMS K73:K83). La pantalla también acepta otros. */
export const TIEMPOS_COMIDA = [
  'Desayuno',
  'Colación 1',
  'Almuerzo',
  'Colación 2',
  'Once',
  'Cena',
  'Colación 3',
  'Colación 4',
  'Colación nocturna',
  'Pre-entreno',
  'Entreno',
  'Post-entreno'
]

const SIN_MACROS: Macros = { kcal: 0, cho: 0, lip: 0, prot: 0 }

export function sumarMacros(lista: Macros[]): Macros {
  return lista.reduce((s, m) => ({ kcal: s.kcal + m.kcal, cho: s.cho + m.cho, lip: s.lip + m.lip, prot: s.prot + m.prot }), SIN_MACROS)
}

export function totalPorciones(p: Porciones): Macros {
  return sumarMacros(
    Object.entries(p).map(([codigo, n = 0]) => {
      const g = GRUPOS_INTERCAMBIO[codigo as CodigoGrupo]
      return { kcal: g.kcal * n, cho: g.cho * n, lip: g.lip * n, prot: g.prot * n }
    })
  )
}

export type ObjetivoCalorico = 'deficit' | 'normo' | 'superavit'

/** Meta del día: el gasto con el ajuste en % del objetivo (la "Reducción" de 24H-REQ B46, igual para los 7 días). */
export function metaKcal(gastoKcal: number, objetivo: ObjetivoCalorico, ajustePct: number): number {
  const signo = { deficit: -1, normo: 0, superavit: 1 }[objetivo]
  return gastoKcal * (1 + (signo * ajustePct) / 100)
}

export type Requerimiento = Macros & {
  pct: { cho: number; lip: number; prot: number } // fracción del VCT (0 a 1)
  choGKg: number
}

/** Proteínas y lípidos en g/kg de peso; los carbohidratos completan la meta (24H-REQ K56:R73). cho < 0 si no alcanzan. */
export function requerimientoDia(e: { kcal: number; pesoKg: number; protGKg: number; lipGKg: number }): Requerimiento {
  const prot = e.protGKg * e.pesoKg
  const lip = e.lipGKg * e.pesoKg
  const cho = (e.kcal - 4 * prot - 9 * lip) / 4
  return {
    kcal: e.kcal,
    cho,
    lip,
    prot,
    pct: { cho: (4 * cho) / e.kcal, lip: (9 * lip) / e.kcal, prot: (4 * prot) / e.kcal },
    choGKg: cho / e.pesoKg
  }
}

/** Agua recomendada en litros: 35 ml/kg al día y 5 ml/kg 3 a 4 horas antes del ejercicio (hoja PLAN Y40:Y41). */
export function hidratacion(pesoKg: number) {
  return { diaL: (pesoKg * 35) / 1000, antesEjercicioL: (pesoKg * 5) / 1000 }
}

/** kg por mes según la diferencia entre gasto y meta, con 7000 kcal por kg como 24H-REQ B47. Positivo = pérdida. */
export function cambioEstimadoKgMes(gastoKcal: number, metaKcalDia: number): number {
  return ((gastoKcal - metaKcalDia) * 30) / 7000
}
