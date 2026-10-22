// Contrato entre frontend y backend: esquemas de entrada (Zod) y tipos de salida por canal.
import { z } from 'zod'
import { GRUPOS, type Medidas } from '../calculo/antropometria'
import { ADICIONAL, type EntradaGasto, type EstadoFisiologico, type ResultadoGasto } from '../calculo/gasto'
import { edadEnAnios, formatearRut, hoyISO, validarRut } from './validaciones'

z.config(z.locales.es())

export const PERFILES = ['nino', 'adolescente', 'adulto', 'adulto_mayor', 'deportista', 'gestante'] as const
export type Perfil = (typeof PERFILES)[number]
export const NOMBRE_PERFIL: Record<Perfil, string> = {
  nino: 'Niño o niña',
  adolescente: 'Adolescente',
  adulto: 'Adulto',
  adulto_mayor: 'Adulto mayor',
  deportista: 'Deportista',
  gestante: 'Gestante o nodriza'
}

export const PREFERENCIAS = ['omnivoro', 'vegetariano', 'ovolacteo_vegetariano', 'ovo_vegano', 'ovolacteo_pescetariano', 'vegano'] as const
export const NOMBRE_PREFERENCIA: Record<(typeof PREFERENCIAS)[number], string> = {
  omnivoro: 'Omnívoro',
  vegetariano: 'Vegetariano',
  ovolacteo_vegetariano: 'Ovo-lácteo vegetariano',
  ovo_vegano: 'Ovo vegano',
  ovolacteo_pescetariano: 'Ovo-lácteo pescetariano',
  vegano: 'Vegano'
}

export const SINTOMAS = ['diarrea', 'vomitos', 'cefaleas', 'estrenimiento', 'gastritis'] as const
export const NOMBRE_SINTOMA: Record<(typeof SINTOMAS)[number], string> = {
  diarrea: 'Diarrea',
  vomitos: 'Vómitos',
  cefaleas: 'Cefaleas',
  estrenimiento: 'Estreñimiento',
  gastritis: 'Gastritis'
}

export const FRECUENCIAS = ['diario', 'semanal', 'fin_de_semana', 'ocasional'] as const
export const NOMBRE_FRECUENCIA: Record<(typeof FRECUENCIAS)[number], string> = {
  diario: 'Todos los días',
  semanal: 'Varias veces por semana',
  fin_de_semana: 'Solo fines de semana',
  ocasional: 'Ocasional (una vez al mes o menos)'
}
// '' = no consume; la frecuencia = sí consume. null (marcó "Sí" sin elegir frecuencia) no pasa la validación.
const consumo = (que: string) => z.union([z.literal(''), z.enum(FRECUENCIAS)], `Indique con qué frecuencia consume ${que}`)

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha')

export const pacienteEntrada = z
  .object({
    id: z.number().int().positive().optional(),
    rut: z
      .string()
      .trim()
      .refine((s) => s === '' || validarRut(s), 'RUT inválido')
      .transform((s) => (s === '' ? null : formatearRut(s))),
    nombres: z.string().trim().min(1, 'Requerido'),
    apellidos: z.string().trim().min(1, 'Requerido'),
    fechaNacimiento: fecha.refine((f) => f <= hoyISO(), 'La fecha no puede ser futura'),
    sexo: z.enum(['F', 'M'], 'Seleccione el sexo'),
    perfil: z.enum(PERFILES, 'Seleccione un perfil'),
    disciplina: z.string().trim(),
    direccion: z.string().trim(),
    telefono: z.string().trim(),
    correo: z
      .string()
      .trim()
      .refine((s) => s === '' || z.email().safeParse(s).success, 'Correo inválido'),
    preferencia: z.enum(PREFERENCIAS).nullable(),
    sintomas: z.array(z.enum(SINTOMAS)),
    tabaco: consumo('tabaco'),
    alcohol: consumo('alcohol'),
    objetivo: z.string().trim(),
    consentimiento: z.boolean().refine((v) => v, 'Sin consentimiento expreso no se pueden registrar datos de salud'),
    tutorNombre: z.string().trim()
  })
  .refine((p) => p.tutorNombre !== '' || !fecha.safeParse(p.fechaNacimiento).success || edadEnAnios(p.fechaNacimiento, hoyISO()) >= 18, {
    path: ['tutorNombre'],
    message: 'Paciente menor de edad: indique el tutor que consiente'
  })

export type PacienteFormulario = z.input<typeof pacienteEntrada>
export type PacienteGuardar = z.output<typeof pacienteEntrada>
export type Paciente = Omit<PacienteGuardar, 'id'> & { id: number; consentimientoFecha: string }
export type PacienteResumen = Pick<Paciente, 'id' | 'rut' | 'fechaNacimiento' | 'sexo' | 'perfil'> & { nombre: string }

export type ActividadMet = { id: number; codigo: string | null; categoria: string; nombre: string; met: number; estimado: boolean }

const bloqueRutina = z.object({
  actividadId: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1, 'Elija una actividad en cada bloque'),
  met: z.number().min(0.5, 'MET mínimo 0,5').max(25, 'MET máximo 25'),
  minutos: z.number().int().min(1, 'Cada actividad dura al menos 1 minuto').max(1440)
})
export type BloqueRutina = z.output<typeof bloqueRutina>

const examen = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese la fecha de cada examen')
    .refine((f) => f <= hoyISO(), 'La fecha de un examen no puede ser futura'),
  detalle: z.string().trim().min(1, 'Describa cada examen y su resultado')
})
export type Examen = z.output<typeof examen>

// Un registro por grupo de GRUPOS con solo los sitios medidos, cada uno dentro del rango de su grupo.
const medidas = z.object(
  Object.fromEntries(
    Object.entries(GRUPOS).map(([g, { titulo, unidad, max, sitios }]) => [
      g,
      z.partialRecord(
        z.enum(Object.keys(sitios)),
        z.number().positive(`${titulo}: los valores deben ser mayores que 0`).max(max, `${titulo}: máximo ${max} ${unidad}`).optional()
      )
    ])
  )
) as unknown as z.ZodType<Medidas, Medidas>

export const controlGuardar = z.object({
  id: z.number().int().positive(),
  fecha: fecha.refine((f) => f <= hoyISO(), 'La fecha no puede ser futura'),
  pesoKg: z.number('Ingrese el peso').min(1).max(400),
  tallaCm: z.number().min(30).max(250).nullable(),
  masaLibreGrasaKg: z.number().min(1).max(200).nullable(),
  formulaId: z.string(),
  modo: z.enum(['estandar', 'tmb']),
  metReposo: z.number().min(0.9).max(3),
  eta: z.boolean(),
  estado: z.enum(Object.keys(ADICIONAL) as [EstadoFisiologico, ...EstadoFisiologico[]]).nullable(),
  tmbManual: z.number().min(300, 'TMB mínima 300 kcal').max(6000, 'TMB máxima 6000 kcal').nullable(),
  objetivoCalorico: z.enum(['deficit', 'normo', 'superavit']),
  ajustePct: z.number().int().min(0).max(50, 'El ajuste calórico máximo es 50 %'),
  motivo: z.string().trim(),
  notas: z.string().trim(),
  alergias: z.string().trim(),
  intolerancias: z.string().trim(),
  enfermedades: z.string().trim(),
  medicamentos: z.string().trim(),
  examenes: z.array(examen),
  antropometria: medidas,
  semana: z.array(z.array(bloqueRutina)).length(7)
})
export type ControlGuardar = z.output<typeof controlGuardar>
export type Control = Omit<ControlGuardar, 'pesoKg'> & {
  pesoKg: number | null
  pacienteId: number
  edadMeses: number | null
  gasto: ResultadoGasto | null
}
export type ControlResumen = Pick<Control, 'id' | 'fecha' | 'pesoKg' | 'tallaCm' | 'edadMeses' | 'motivo'> & { promedioKcal: number | null }
/** Lo que el informe antropométrico necesita de cada control con peso para graficar la evolución. */
export type EvolucionControl = Pick<Control, 'id' | 'fecha' | 'tallaCm' | 'antropometria'> & { pesoKg: number }

/** Arma la entrada del motor igual en la pantalla (cálculo en vivo) y en el backend (cálculo que se guarda). */
export function entradaGasto(c: ControlGuardar, p: Pick<Paciente, 'fechaNacimiento' | 'sexo'>): EntradaGasto {
  return {
    paciente: {
      pesoKg: c.pesoKg,
      tallaCm: c.tallaCm ?? undefined,
      masaLibreGrasaKg: c.masaLibreGrasaKg ?? undefined,
      edad: edadEnAnios(p.fechaNacimiento, c.fecha),
      sexo: p.sexo
    },
    formulaId: c.formulaId,
    tmbManual: c.tmbManual ?? undefined,
    modo: c.modo,
    metReposo: c.metReposo,
    eta: c.eta,
    estado: c.estado ?? undefined,
    semana: c.semana
  }
}

export const entradas = {
  'sesion.estado': z.undefined(),
  'sesion.configurar': z.object({
    nombreProfesional: z.string().trim().min(1, 'Requerido'),
    contrasena: z.string().min(8, 'Mínimo 8 caracteres')
  }),
  'sesion.desbloquear': z.object({ secreto: z.string().min(1, 'Requerido') }),
  'sesion.bloquear': z.undefined(),
  'pacientes.listar': z.object({ busqueda: z.string().trim(), perfil: z.enum(PERFILES).nullable() }),
  'pacientes.obtener': z.object({ id: z.number().int().positive() }),
  'pacientes.guardar': pacienteEntrada,
  'catalogos.met': z.undefined(),
  'controles.listar': z.object({ pacienteId: z.number().int().positive() }),
  'controles.crear': z.object({ pacienteId: z.number().int().positive() }),
  'controles.evolucion': z.object({ pacienteId: z.number().int().positive() }),
  'controles.obtener': z.object({ id: z.number().int().positive() }),
  'controles.descartar': z.object({ id: z.number().int().positive() }),
  'controles.guardar': controlGuardar
}

export type Salidas = {
  'sesion.estado': { configurada: boolean; abierta: boolean }
  'sesion.configurar': { claveRecuperacion: string }
  'sesion.desbloquear': null
  'sesion.bloquear': null
  'pacientes.listar': PacienteResumen[]
  'pacientes.obtener': Paciente
  'pacientes.guardar': Paciente
  'catalogos.met': ActividadMet[]
  'controles.listar': ControlResumen[]
  'controles.crear': { id: number }
  'controles.evolucion': EvolucionControl[]
  'controles.obtener': Control
  'controles.descartar': null
  'controles.guardar': Control
}

export type Canal = keyof typeof entradas
export type Entrada<C extends Canal> = z.input<(typeof entradas)[C]>
export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string }

/** Lo único que el preload expone a la ventana como window.nutri. */
export type ApiNutri = {
  invocar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Respuesta<Salidas[C]>>
}
