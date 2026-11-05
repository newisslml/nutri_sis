// Contrato entre frontend y backend: esquemas de entrada (Zod) y tipos de salida por canal.
import { z } from 'zod'
import { GRUPOS, type Medidas } from '../calculo/antropometria'
import { FORMULAS } from '../calculo/formulas'
import { ADICIONAL, GRUPOS_JUVENILES, type EntradaGasto, type EstadoFisiologico, type ResultadoGasto } from '../calculo/gasto'
import { CODIGOS } from '../calculo/intercambio'
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
    // Vacíos = nació de término o no se sabe. NumberInput deja '' al borrar.
    semanasGestacion: z
      .union([z.literal(''), z.number().int('Semanas cumplidas, sin decimales').min(22, 'Mínimo 22 semanas').max(42, 'Máximo 42 semanas')])
      .nullable()
      .transform((v) => (v === '' ? null : v)),
    pesoNacerG: z
      .union([z.literal(''), z.number().int('Gramos, sin decimales').min(300, 'Mínimo 300 g').max(6000, 'Máximo 6.000 g')])
      .nullable()
      .transform((v) => (v === '' ? null : v)),
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

export type ActividadMet = { id: number; codigo: string | null; categoria: string; nombre: string; met: number; estimado: boolean; poblacion: string }
/** Poblaciones de la tabla MET: adultos, los grupos de edad del compendio juvenil y mayores de 60. */
export const POBLACIONES_MET = ['adulto', ...GRUPOS_JUVENILES, '60+'] as [string, ...string[]]
const actividadMet = z.object({
  id: z.number().int().positive().optional(),
  codigo: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : s)),
  categoria: z.string().trim().min(1, 'Indique la categoría'),
  nombre: z.string().trim().min(1, 'Indique la actividad'),
  met: z.number('Ingrese el MET').min(0.5, 'MET mínimo 0,5').max(25, 'MET máximo 25'),
  poblacion: z.enum(POBLACIONES_MET, 'Elija la población')
})
export type ActividadMetFormulario = z.input<typeof actividadMet>
export type ActividadMetGuardar = z.output<typeof actividadMet>

const idsFormula = FORMULAS.map((f) => f.id) as [string, ...string[]]
/** Preferencias del profesional (tabla configuracion). Las de cálculo valen para el primer control de cada paciente; los siguientes copian el anterior. */
export const configuracion = z.object({
  formulaAdulto: z.enum(idsFormula), // desde los 19 años
  formulaMenor: z.enum(idsFormula),
  modo: z.enum(['estandar', 'tmb']),
  metReposo: z.number().min(0.9, 'MET de reposo mínimo 0,9').max(3, 'MET de reposo máximo 3'),
  eta: z.boolean(),
  carpetaRespaldo: z.string().nullable(), // null: carpeta "respaldos" junto a los datos
  copiasRespaldo: z.number('Indique cuántas copias').int().min(1, 'Guarde al menos 1 copia').max(100, 'Máximo 100 copias'),
  minutosBloqueo: z.number('Indique los minutos').int().min(0).max(240, 'Máximo 240 minutos') // 0: no se bloquea solo
})
export type Configuracion = z.output<typeof configuracion>
// MET de reposo 1,3: sentado tranquilo (07021). ETA apagado para no duplicarlo con los MET.
export const CONFIGURACION_INICIAL: Configuracion = {
  formulaAdulto: 'mifflin-st-jeor',
  formulaMenor: 'fao-oms-unu-schofield',
  modo: 'estandar',
  metReposo: 1.3,
  eta: false,
  carpetaRespaldo: null,
  copiasRespaldo: 10,
  minutosBloqueo: 15
}

/** Un respaldo en disco; fecha local AAAA-MM-DDTHH:MM:SS. */
export type Respaldo = { carpeta: string; fecha: string; bytes: number }

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

// Porciones de intercambio por código de grupo; media porción es habitual. Un valor borrado queda undefined, como en medidas.
const porciones = z.partialRecord(z.enum(CODIGOS), z.number().min(0, 'Las porciones no pueden ser negativas').max(20, 'Máximo 20 porciones por grupo').optional())
const tiempoComida = {
  tiempo: z.string().trim().min(1, 'Indique el tiempo de comida de cada fila'),
  hora: z.string().regex(/^(\d{2}:\d{2})?$/, 'Hora inválida'),
  porciones
}
const recordatorio = z.object({
  comidas: z.array(z.object({ ...tiempoComida, alimentos: z.string().trim() })),
  noConsume: z.array(z.enum(CODIGOS))
})
export type Recordatorio = z.output<typeof recordatorio>
export type ComidaRecordatorio = Recordatorio['comidas'][number]

// Recomendaciones y suplementos se guardan como texto copiado: el control no cambia si después se edita el catálogo.
const pauta = z.object({
  protGKg: z.number().min(0).max(4, 'Proteínas: máximo 4 g/kg'),
  lipGKg: z.number().min(0).max(3, 'Lípidos: máximo 3 g/kg'),
  semanasProximo: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  objetivo: z.string().trim(),
  regimen: z.array(z.string()),
  metas: z.string().trim(),
  recomendaciones: z.array(z.string()),
  comentario: z.string().trim(),
  suplementos: z.array(z.object({ producto: z.string().trim().min(1, 'Elija el producto de cada suplemento'), dosis: z.string().trim() })),
  dias: z.array(z.array(z.object({ ...tiempoComida, idea: z.string().trim() }))).length(7)
})
export type Pauta = z.output<typeof pauta>
export type ComidaPauta = Pauta['dias'][number][number]
/** Pauta de un control sin datos: 1,8 y 0,5 g/kg como la hoja 24H-REQ (B50 y B55) hasta que Fabi defina otros. */
export const pautaVacia = (): Pauta => ({
  protGKg: 1.8,
  lipGKg: 0.5,
  semanasProximo: 6,
  objetivo: '',
  regimen: [],
  metas: '',
  recomendaciones: [],
  comentario: '',
  suplementos: [],
  dias: [[], [], [], [], [], [], []]
})

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
  semanaEmbarazo: z.number().int('Semanas cumplidas, sin decimales').min(1).max(42, 'Máximo 42 semanas').nullable(),
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
  semana: z.array(z.array(bloqueRutina)).length(7),
  recordatorio,
  pauta
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
export type EvolucionControl = Pick<Control, 'id' | 'fecha' | 'tallaCm' | 'antropometria' | 'estado'> & { pesoKg: number }

/** Todo lo que el sistema guarda de un paciente, para entregárselo si lo pide (Ley 21.719). */
export type ExportacionPaciente = {
  sistema: string
  generado: string
  paciente: Paciente
  controles: Control[]
  auditoria: { fecha: string; tabla: string; registroId: number; campo: string; valorAnterior: string | null; valorNuevo: string | null }[]
}

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
  // recordar: true guarda la clave en este equipo (safeStorage), false la olvida, sin valor no cambia nada.
  'sesion.desbloquear': z.object({ secreto: z.string().min(1, 'Requerido'), recordar: z.boolean().optional() }),
  'sesion.bloquear': z.undefined(),
  'sesion.cambiarContrasena': z.object({
    actual: z.string().min(1, 'Requerido'),
    nueva: z.string().min(8, 'Mínimo 8 caracteres')
  }),
  'sesion.olvidarEquipo': z.undefined(),
  'configuracion.obtener': z.undefined(),
  'configuracion.guardar': configuracion,
  // carpeta null: la configurada. Puede ser un respaldo o la carpeta que los contiene.
  'respaldo.listar': z.object({ carpeta: z.string().nullable() }),
  'respaldo.crear': z.undefined(),
  'respaldo.restaurar': z.object({ carpeta: z.string().min(1), secreto: z.string().min(1, 'Requerido') }),
  'pacientes.listar': z.object({ busqueda: z.string().trim(), perfil: z.enum(PERFILES).nullable() }),
  'pacientes.obtener': z.object({ id: z.number().int().positive() }),
  'pacientes.guardar': pacienteEntrada,
  'pacientes.exportar': z.object({ id: z.number().int().positive() }),
  'pacientes.eliminar': z.object({ id: z.number().int().positive() }),
  'catalogos.met': z.undefined(),
  'catalogos.guardarMet': actividadMet,
  'catalogos.eliminarMet': z.object({ id: z.number().int().positive() }),
  'demo.crear': z.undefined(),
  'demo.eliminar': z.undefined(),
  'controles.listar': z.object({ pacienteId: z.number().int().positive() }),
  'controles.crear': z.object({ pacienteId: z.number().int().positive() }),
  'controles.evolucion': z.object({ pacienteId: z.number().int().positive() }),
  'controles.obtener': z.object({ id: z.number().int().positive() }),
  'controles.descartar': z.object({ id: z.number().int().positive() }),
  'controles.guardar': controlGuardar,
  'archivos.guardarPdf': z.object({ nombre: z.string().trim().min(1), mismaCarpeta: z.boolean().optional() }),
  'archivos.elegirCarpeta': z.object({ titulo: z.string() })
}

export type Salidas = {
  // recordarDisponible: el equipo puede guardar la clave cifrada (app de escritorio); recordada: ya la tiene guardada.
  'sesion.estado': { configurada: boolean; abierta: boolean; profesional: string | null; recordarDisponible: boolean; recordada: boolean }
  'sesion.configurar': { claveRecuperacion: string }
  'sesion.desbloquear': null
  'sesion.bloquear': null
  'sesion.cambiarContrasena': null
  'sesion.olvidarEquipo': null
  'configuracion.obtener': Configuracion
  'configuracion.guardar': Configuracion
  'respaldo.listar': { carpeta: string; respaldos: Respaldo[] }
  'respaldo.crear': { ruta: string | null } // null: no hubo cambios desde el último
  'respaldo.restaurar': null
  'pacientes.listar': PacienteResumen[]
  'pacientes.obtener': Paciente
  'pacientes.guardar': Paciente
  'pacientes.exportar': ExportacionPaciente
  'pacientes.eliminar': null
  'catalogos.met': ActividadMet[]
  'catalogos.guardarMet': ActividadMet
  'catalogos.eliminarMet': null
  'demo.crear': { pacientes: number }
  'demo.eliminar': { pacientes: number }
  'controles.listar': ControlResumen[]
  'controles.crear': { id: number }
  'controles.evolucion': EvolucionControl[]
  'controles.obtener': Control
  'controles.descartar': null
  'controles.guardar': Control
  'archivos.guardarPdf': string | null // ruta del PDF, o null si se canceló
  'archivos.elegirCarpeta': string | null // null si se canceló
}

export type Canal = keyof typeof entradas
export type Entrada<C extends Canal> = z.input<(typeof entradas)[C]>
export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string }

/** Lo único que el preload expone a la ventana como window.nutri. */
export type ApiNutri = {
  invocar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Respuesta<Salidas[C]>>
}
