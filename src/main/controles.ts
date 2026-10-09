import { calcularGastoSemanal } from '../calculo/gasto'
import { entradaGasto, type ActividadMet, type Control, type ControlGuardar, type ControlResumen } from '../shared/contratos'
import { edadEnAnios, hoyISO } from '../shared/validaciones'
import type { DB } from './db'

export function actividades(db: DB): ActividadMet[] {
  return db
    .prepare('SELECT id, codigo, categoria, nombre, met, estimado FROM actividad_met ORDER BY codigo, nombre')
    .all()
    .map((a) => ({ ...(a as ActividadMet), estimado: (a as { estimado: number }).estimado === 1 }))
}

export function listar(db: DB, pacienteId: number): ControlResumen[] {
  return db
    .prepare(
      `SELECT id, fecha, peso_kg AS pesoKg, json_extract(gasto, '$.promedio') AS promedioKcal
       FROM control WHERE paciente_id = ? ORDER BY fecha DESC, id DESC`
    )
    .all(pacienteId) as ControlResumen[]
}

/** Control nuevo con fecha de hoy. Mifflin-St Jeor para adultos, FAO/OMS/UNU (solo pide peso) para menores. */
export function crear(db: DB, pacienteId: number, profesionalId: number): number {
  const p = db.prepare('SELECT fecha_nacimiento AS f FROM paciente WHERE id = ?').get(pacienteId) as { f: string } | undefined
  if (!p) throw new Error('Paciente no encontrado')
  const fecha = hoyISO()
  const formula = edadEnAnios(p.f, fecha) >= 19 ? 'mifflin-st-jeor' : 'fao-oms-unu-schofield'
  // ponytail: MET de reposo 1,3 (sentado tranquilo, 07021) fijo; pasa a Configuración cuando el profesional lo defina.
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO control (paciente_id, profesional_id, fecha, formula_id, modo_met, met_reposo)
       VALUES (?, ?, ?, ?, 'estandar', 1.3)`
    )
    .run(pacienteId, profesionalId, fecha, formula)
  return Number(lastInsertRowid)
}

export function obtener(db: DB, id: number): Control {
  const c = db
    .prepare(
      `SELECT id, paciente_id AS pacienteId, fecha, peso_kg AS pesoKg, talla_cm AS tallaCm, formula_id AS formulaId,
         modo_met AS modo, met_reposo AS metReposo, eta, estado_fisiologico AS estado, gasto
       FROM control WHERE id = ?`
    )
    .get(id) as (Omit<Control, 'eta' | 'gasto' | 'semana'> & { eta: number; gasto: string | null }) | undefined
  if (!c) throw new Error('Control no encontrado')
  const semana: Control['semana'] = [[], [], [], [], [], [], []]
  const bloques = db
    .prepare('SELECT dia, actividad_id AS actividadId, nombre, met, minutos FROM rutina_bloque WHERE control_id = ? ORDER BY id')
    .all(id) as ({ dia: number } & Control['semana'][number][number])[]
  for (const { dia, ...b } of bloques) semana[dia].push(b)
  return { ...c, eta: c.eta === 1, gasto: c.gasto ? JSON.parse(c.gasto) : null, semana }
}

/** Recalcula con el motor y congela el resultado junto con los MET usados. */
export function guardar(db: DB, c: ControlGuardar): Control {
  const actual = obtener(db, c.id)
  const paciente = db.prepare('SELECT fecha_nacimiento AS fechaNacimiento, sexo FROM paciente WHERE id = ?').get(actual.pacienteId) as {
    fechaNacimiento: string
    sexo: 'F' | 'M'
  }
  if (c.estado && paciente.sexo !== 'F') throw new Error('Gestación y lactancia solo aplican a pacientes de sexo femenino')
  const gasto = calcularGastoSemanal(entradaGasto(c, paciente))

  const insertar = db.prepare(
    'INSERT INTO rutina_bloque (control_id, dia, actividad_id, nombre, met, minutos) VALUES (?, ?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    db.prepare(
      `UPDATE control SET fecha = ?, peso_kg = ?, talla_cm = ?, formula_id = ?, modo_met = ?, met_reposo = ?, eta = ?,
         estado_fisiologico = ?, gasto = ? WHERE id = ?`
    ).run(c.fecha, c.pesoKg, c.tallaCm, c.formulaId, c.modo, c.metReposo, c.eta ? 1 : 0, c.estado, JSON.stringify(gasto), c.id)
    db.prepare('DELETE FROM rutina_bloque WHERE control_id = ?').run(c.id)
    c.semana.forEach((bloques, dia) => {
      for (const b of bloques) insertar.run(c.id, dia, b.actividadId, b.nombre, b.met, b.minutos)
    })
  })()
  return obtener(db, c.id)
}
