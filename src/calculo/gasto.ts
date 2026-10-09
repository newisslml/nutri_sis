// Gasto energético por día de la semana: TMB (fórmula del catálogo) + actividades ponderadas por MET.
//   modo 'estandar': kcal = Σ MET × peso × horas          (supone 1 kcal/kg/h en reposo)
//   modo 'tmb':      kcal = TMB/24 × Σ MET × horas        (cambiar de fórmula cambia el resultado)
// Las horas sin asignar se completan con el MET de reposo, para que el día cierre en 24 horas.
import { FORMULAS, faltantes, type DatosPaciente } from './formulas.ts'

export type Modo = 'estandar' | 'tmb'
export type Bloque = { met: number; minutos: number }

/** Adicional energético diario (kcal), FAO/WHO/UNU 2004. */
export const ADICIONAL = {
  gestacion_t1: 85,
  gestacion_t2: 285,
  gestacion_t3: 475,
  lactancia_0_6: 505,
  lactancia_0_6_ganancia_insuficiente: 675,
  lactancia_7_12: 460
}
export type EstadoFisiologico = keyof typeof ADICIONAL

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export type EntradaGasto = {
  paciente: DatosPaciente
  formulaId: string
  tmbManual?: number // reemplaza la fórmula (p. ej. calorimetría)
  modo: Modo
  metReposo: number
  eta: boolean // suma 10 % por efecto térmico de los alimentos
  estado?: EstadoFisiologico
  semana: Bloque[][] // 7 días, de lunes a domingo
}

export type ResultadoGasto = {
  tmb: number
  formula: { id: string; version: number }
  modo: Modo // el aplicado, que puede diferir del pedido
  porDia: number[]
  promedio: number
  avisos: string[]
}

export function calcularTMB(formulaId: string, d: DatosPaciente) {
  const f = FORMULAS.find((f) => f.id === formulaId)
  if (!f) throw new Error(`Fórmula desconocida: ${formulaId}`)
  const faltan = faltantes(f, d)
  if (faltan.length) throw new Error(`Faltan datos para ${f.nombre}: ${faltan.join(', ')}`)
  const { edadMin = 0, edadMax = Infinity, descripcion } = f.poblacion
  const avisos = d.edad < edadMin || d.edad > edadMax ? [`${f.nombre} está validada en ${descripcion}`] : []
  return { tmb: f.calcular(d), formula: { id: f.id, version: f.version }, avisos }
}

export function calcularGastoSemanal(e: EntradaGasto): ResultadoGasto {
  if (e.semana.length !== 7) throw new Error('La semana debe tener 7 días')
  const { pesoKg, edad } = e.paciente
  const basal =
    e.tmbManual === undefined
      ? calcularTMB(e.formulaId, e.paciente)
      : { tmb: e.tmbManual, formula: { id: 'manual', version: 1 }, avisos: ['TMB ingresada a mano'] }
  const avisos = [...basal.avisos]

  let modo = e.modo
  if (edad < 18 && modo === 'estandar') {
    modo = 'tmb'
    avisos.push('Menor de 18 años: se usa el modo TMB, porque los METy del compendio juvenil son múltiplos de su TMB')
  }
  if (e.tmbManual !== undefined && modo === 'estandar') {
    avisos.push('En modo MET × peso la TMB ajustada no cambia el gasto; use el modo MET × TMB/24')
  }
  if (edad < 6) avisos.push('El compendio juvenil cubre de 6 a 17 años: en menores de 6 el gasto por MET es solo referencial')
  if (e.estado?.startsWith('gestacion')) avisos.push('En gestación la TMB se calcula con el peso pregestacional')

  const kcalPorMetHora = modo === 'tmb' ? basal.tmb / 24 : pesoKg
  const dias = e.semana.map((bloques, i) => {
    const minutos = bloques.reduce((s, b) => s + b.minutos, 0)
    if (minutos > 1440) throw new Error(`${DIAS[i]} suma más de 24 horas`)
    const metMinutos = bloques.reduce((s, b) => s + b.met * b.minutos, 0) + e.metReposo * (1440 - minutos)
    return (metMinutos / 60) * kcalPorMetHora * (e.eta ? 1.1 : 1) + (e.estado ? ADICIONAL[e.estado] : 0)
  })

  return {
    tmb: Math.round(basal.tmb),
    formula: basal.formula,
    modo,
    porDia: dias.map((k) => Math.round(k)),
    promedio: Math.round(dias.reduce((s, k) => s + k, 0) / 7),
    avisos
  }
}
