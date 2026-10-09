// Contrato entre frontend y backend: esquemas de entrada (Zod) y tipos de salida por canal.
import { z } from 'zod'
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
    antecedentes: z.string().trim(),
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
  'pacientes.guardar': pacienteEntrada
}

export type Salidas = {
  'sesion.estado': { configurada: boolean; abierta: boolean }
  'sesion.configurar': { claveRecuperacion: string }
  'sesion.desbloquear': null
  'sesion.bloquear': null
  'pacientes.listar': PacienteResumen[]
  'pacientes.obtener': Paciente
  'pacientes.guardar': Paciente
}

export type Canal = keyof typeof entradas
export type Entrada<C extends Canal> = z.input<(typeof entradas)[C]>
export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string }

/** Lo único que el preload expone a la ventana como window.nutri. */
export type ApiNutri = {
  invocar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Respuesta<Salidas[C]>>
}
