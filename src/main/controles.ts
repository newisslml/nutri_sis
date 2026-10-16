import { calcularGastoSemanal } from '../calculo/gasto'
import { entradaGasto, type ActividadMet, type Control, type ControlGuardar, type ControlResumen } from '../shared/contratos'
import { edadEnMeses, hoyISO } from '../shared/validaciones'
import { auditar, type DB } from './db'

export function actividades(db: DB): ActividadMet[] {
  return db
    .prepare('SELECT id, codigo, categoria, nombre, met, estimado FROM actividad_met ORDER BY codigo, nombre')
    .all()
    .map((a) => ({ ...(a as ActividadMet), estimado: (a as { estimado: number }).estimado === 1 }))
}

export function listar(db: DB, pacienteId: number): ControlResumen[] {
  return db
    .prepare(
      `SELECT id, fecha, peso_kg AS pesoKg, talla_cm AS tallaCm, edad_meses AS edadMeses, motivo,
         json_extract(gasto, '$.promedio') AS promedioKcal
       FROM control WHERE paciente_id = ? ORDER BY fecha DESC, id DESC`
    )
    .all(pacienteId) as ControlResumen[]
}

/**
 * Control nuevo con fecha de hoy. Si hay uno anterior guardado, copia su rutina, sus parámetros y el historial médico
 * para editar solo lo que cambió; la talla se copia solo en adultos (en niños se vuelve a medir). El peso siempre se mide de nuevo.
 */
export function crear(db: DB, pacienteId: number, profesionalId: number): number {
  const p = db.prepare('SELECT fecha_nacimiento AS f FROM paciente WHERE id = ?').get(pacienteId) as { f: string } | undefined
  if (!p) throw new Error('Paciente no encontrado')
  const fecha = hoyISO()
  const meses = edadEnMeses(p.f, fecha)
  const anterior = db
    .prepare(
      `SELECT id, talla_cm AS tallaCm, formula_id AS formulaId, modo_met AS modo, met_reposo AS metReposo, eta, estado_fisiologico AS estado,
         alergias, intolerancias, enfermedades, medicamentos, examenes
       FROM control WHERE paciente_id = ? AND gasto IS NOT NULL ORDER BY fecha DESC, id DESC LIMIT 1`
    )
    .get(pacienteId) as
    | {
        id: number
        tallaCm: number | null
        formulaId: string
        modo: string
        metReposo: number
        eta: number
        estado: string | null
        alergias: string
        intolerancias: string
        enfermedades: string
        medicamentos: string
        examenes: string
      }
    | undefined
  // ponytail: sin control anterior, MET de reposo 1,3 (sentado tranquilo, 07021) fijo; pasa a Configuración cuando el profesional lo defina.
  const base = anterior ?? {
    tallaCm: null,
    formulaId: meses >= 19 * 12 ? 'mifflin-st-jeor' : 'fao-oms-unu-schofield',
    modo: 'estandar',
    metReposo: 1.3,
    eta: 0,
    estado: null,
    alergias: '',
    intolerancias: '',
    enfermedades: '',
    medicamentos: '',
    examenes: '[]'
  }

  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO control (paciente_id, profesional_id, fecha, edad_meses, talla_cm, formula_id, modo_met, met_reposo, eta, estado_fisiologico,
             alergias, intolerancias, enfermedades, medicamentos, examenes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          pacienteId,
          profesionalId,
          fecha,
          meses,
          meses >= 18 * 12 ? base.tallaCm : null,
          base.formulaId,
          base.modo,
          base.metReposo,
          base.eta,
          base.estado,
          base.alergias,
          base.intolerancias,
          base.enfermedades,
          base.medicamentos,
          base.examenes
        )
        .lastInsertRowid
    )
    if (anterior) {
      db.prepare(
        `INSERT INTO rutina_bloque (control_id, dia, actividad_id, nombre, met, minutos)
         SELECT ?, dia, actividad_id, nombre, met, minutos FROM rutina_bloque WHERE control_id = ? ORDER BY id`
      ).run(id, anterior.id)
    }
    return id
  })()
}

/** Solo se descarta un control que nunca se guardó con cálculo: los registros clínicos no se borran. */
export function descartar(db: DB, id: number): void {
  if (db.prepare('DELETE FROM control WHERE id = ? AND gasto IS NULL').run(id).changes === 0) {
    throw new Error('Solo se puede descartar un control que aún no se ha guardado')
  }
}

export function obtener(db: DB, id: number): Control {
  const c = db
    .prepare(
      `SELECT id, paciente_id AS pacienteId, fecha, edad_meses AS edadMeses, peso_kg AS pesoKg, talla_cm AS tallaCm,
         masa_libre_grasa_kg AS masaLibreGrasaKg, formula_id AS formulaId, tmb_manual AS tmbManual, modo_met AS modo, met_reposo AS metReposo, eta,
         estado_fisiologico AS estado, motivo, notas, alergias, intolerancias, enfermedades, medicamentos, examenes, gasto
       FROM control WHERE id = ?`
    )
    .get(id) as (Omit<Control, 'eta' | 'gasto' | 'semana' | 'examenes'> & { eta: number; gasto: string | null; examenes: string }) | undefined
  if (!c) throw new Error('Control no encontrado')
  const semana: Control['semana'] = [[], [], [], [], [], [], []]
  const bloques = db
    .prepare('SELECT dia, actividad_id AS actividadId, nombre, met, minutos FROM rutina_bloque WHERE control_id = ? ORDER BY id')
    .all(id) as ({ dia: number } & Control['semana'][number][number])[]
  for (const { dia, ...b } of bloques) semana[dia].push(b)
  return { ...c, eta: c.eta === 1, gasto: c.gasto ? JSON.parse(c.gasto) : null, examenes: JSON.parse(c.examenes), semana }
}

/**
 * Recalcula con el motor y congela el resultado junto con los MET usados y la edad a la fecha del control.
 * Si el control ya tenía un cálculo guardado, cada dato y resultado que cambie queda en auditoría.
 */
export function guardar(db: DB, c: ControlGuardar, profesionalId: number): Control {
  const actual = obtener(db, c.id)
  const paciente = db.prepare('SELECT fecha_nacimiento AS fechaNacimiento, sexo FROM paciente WHERE id = ?').get(actual.pacienteId) as {
    fechaNacimiento: string
    sexo: 'F' | 'M'
  }
  if (c.estado && paciente.sexo !== 'F') throw new Error('Gestación y lactancia solo aplican a pacientes de sexo femenino')
  if (c.masaLibreGrasaKg !== null && c.masaLibreGrasaKg >= c.pesoKg) throw new Error('La masa libre de grasa debe ser menor que el peso')
  const gasto = calcularGastoSemanal(entradaGasto(c, paciente))
  const edadMeses = edadEnMeses(paciente.fechaNacimiento, c.fecha)

  const campos = (x: Omit<Control, 'pacienteId' | 'semana' | 'gasto' | 'edadMeses'> & { gasto: Control['gasto'] }) => ({
    fecha: x.fecha,
    pesoKg: x.pesoKg,
    tallaCm: x.tallaCm,
    masaLibreGrasaKg: x.masaLibreGrasaKg,
    formulaId: x.formulaId,
    tmbManual: x.tmbManual,
    modo: x.modo,
    metReposo: x.metReposo,
    eta: x.eta,
    estado: x.estado,
    motivo: x.motivo,
    notas: x.notas,
    alergias: x.alergias,
    intolerancias: x.intolerancias,
    enfermedades: x.enfermedades,
    medicamentos: x.medicamentos,
    examenes: JSON.stringify(x.examenes),
    tmb: x.gasto?.tmb,
    gastoPromedio: x.gasto?.promedio
  })

  const insertar = db.prepare(
    'INSERT INTO rutina_bloque (control_id, dia, actividad_id, nombre, met, minutos) VALUES (?, ?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    db.prepare(
      `UPDATE control SET fecha = ?, edad_meses = ?, peso_kg = ?, talla_cm = ?, masa_libre_grasa_kg = ?, formula_id = ?, tmb_manual = ?,
         modo_met = ?, met_reposo = ?, eta = ?, estado_fisiologico = ?, motivo = ?, notas = ?, alergias = ?, intolerancias = ?,
         enfermedades = ?, medicamentos = ?, examenes = ?, gasto = ? WHERE id = ?`
    ).run(
      c.fecha,
      edadMeses,
      c.pesoKg,
      c.tallaCm,
      c.masaLibreGrasaKg,
      c.formulaId,
      c.tmbManual,
      c.modo,
      c.metReposo,
      c.eta ? 1 : 0,
      c.estado,
      c.motivo,
      c.notas,
      c.alergias,
      c.intolerancias,
      c.enfermedades,
      c.medicamentos,
      JSON.stringify(c.examenes),
      JSON.stringify(gasto),
      c.id
    )
    db.prepare('DELETE FROM rutina_bloque WHERE control_id = ?').run(c.id)
    c.semana.forEach((bloques, dia) => {
      for (const b of bloques) insertar.run(c.id, dia, b.actividadId, b.nombre, b.met, b.minutos)
    })
    if (actual.gasto) auditar(db, 'control', c.id, profesionalId, campos(actual), campos({ ...c, gasto }))
  })()
  return obtener(db, c.id)
}
