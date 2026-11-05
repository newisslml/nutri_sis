import { medidasVacias } from '../calculo/antropometria'
import { calcularGastoSemanal } from '../calculo/gasto'
import {
  entradaGasto,
  pautaVacia,
  type ActividadMet,
  type ActividadMetGuardar,
  type Configuracion,
  type Control,
  type ControlGuardar,
  type ControlResumen,
  type EvolucionControl
} from '../shared/contratos'
import { edadEnMeses, hoyISO } from '../shared/validaciones'
import { auditar, type DB } from './db'

const SELECT_ACTIVIDAD = 'SELECT id, codigo, categoria, nombre, met, estimado, poblacion FROM actividad_met'
const actividad = (a: unknown) => ({ ...(a as ActividadMet), estimado: (a as { estimado: number }).estimado === 1 })

export function actividades(db: DB): ActividadMet[] {
  return db.prepare(`${SELECT_ACTIVIDAD} ORDER BY codigo, nombre`).all().map(actividad)
}

/**
 * Agrega o corrige una actividad de la tabla MET. Los controles guardados no cambian: sus rutinas copian nombre y MET.
 * Una fila del compendio editada queda con "(editada)" en la fuente.
 */
export function guardarActividad(db: DB, a: ActividadMetGuardar, profesionalId: number): ActividadMet {
  const campos = { codigo: a.codigo, categoria: a.categoria, nombre: a.nombre, met: a.met, poblacion: a.poblacion }
  if (a.id === undefined) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO actividad_met (codigo, categoria, nombre, met, poblacion, fuente)
         VALUES (@codigo, @categoria, @nombre, @met, @poblacion, 'Agregada por el profesional')`
      )
      .run(campos)
    return actividad(db.prepare(`${SELECT_ACTIVIDAD} WHERE id = ?`).get(lastInsertRowid))
  }
  const anterior = db.prepare('SELECT codigo, categoria, nombre, met, poblacion FROM actividad_met WHERE id = ?').get(a.id) as
    | typeof campos
    | undefined
  if (!anterior) throw new Error('Actividad no encontrada')
  db.transaction(() => {
    db.prepare(
      `UPDATE actividad_met SET codigo = @codigo, categoria = @categoria, nombre = @nombre, met = @met, poblacion = @poblacion,
         fuente = CASE WHEN fuente LIKE '%(editada)' OR fuente = 'Agregada por el profesional' THEN fuente ELSE fuente || ' (editada)' END
       WHERE id = @id`
    ).run({ ...campos, id: a.id })
    auditar(db, 'actividad_met', a.id!, profesionalId, anterior, campos)
  })()
  return actividad(db.prepare(`${SELECT_ACTIVIDAD} WHERE id = ?`).get(a.id))
}

/** Solo se elimina una actividad que ninguna rutina guardada usa; si no, se corrige su nombre o MET. */
export function eliminarActividad(db: DB, id: number, profesionalId: number): void {
  const anterior = db.prepare('SELECT nombre FROM actividad_met WHERE id = ?').get(id) as { nombre: string } | undefined
  if (!anterior) throw new Error('Actividad no encontrada')
  if (db.prepare('SELECT 1 FROM rutina_bloque WHERE actividad_id = ? LIMIT 1').get(id)) {
    throw new Error('La actividad se usa en rutinas de controles: no se puede eliminar, pero sí corregir su nombre o MET')
  }
  db.transaction(() => {
    db.prepare('DELETE FROM actividad_met WHERE id = ?').run(id)
    auditar(db, 'actividad_met', id, profesionalId, { nombre: anterior.nombre }, { nombre: null })
  })()
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

/** Controles con peso, del más antiguo al más reciente. */
export function evolucion(db: DB, pacienteId: number): EvolucionControl[] {
  return db
    .prepare(
      `SELECT id, fecha, peso_kg AS pesoKg, talla_cm AS tallaCm, antropometria, estado_fisiologico AS estado
       FROM control WHERE paciente_id = ? AND peso_kg IS NOT NULL ORDER BY fecha, id`
    )
    .all(pacienteId)
    .map((c) => ({ ...(c as EvolucionControl), antropometria: { ...medidasVacias(), ...JSON.parse((c as { antropometria: string }).antropometria) } }))
}

/** Valores de cálculo para el primer control de un paciente. */
export type Predeterminado = Pick<Configuracion, 'formulaAdulto' | 'formulaMenor' | 'modo' | 'metReposo' | 'eta'>

/**
 * Control nuevo con fecha de hoy. Sin control anterior, la fórmula, el modo MET, el MET de reposo y el ETA salen de Configuración.
 * Si hay uno anterior guardado, copia su rutina, sus parámetros, el historial médico y la pauta
 * para editar solo lo que cambió; la talla se copia solo en adultos (en niños se vuelve a medir). Terminado el crecimiento (21 años en
 * hombres, 19 en mujeres) los diámetros óseos no cambian: se copian de la última medición hecha desde esa edad. El peso siempre se
 * mide de nuevo y el recordatorio de 24 horas parte vacío.
 */
export function crear(db: DB, pacienteId: number, profesionalId: number, predeterminado: Predeterminado): number {
  const p = db.prepare('SELECT fecha_nacimiento AS f, sexo FROM paciente WHERE id = ?').get(pacienteId) as { f: string; sexo: string } | undefined
  if (!p) throw new Error('Paciente no encontrado')
  const fecha = hoyISO()
  const meses = edadEnMeses(p.f, fecha)
  const adultoDesde = (p.sexo === 'M' ? 21 : 19) * 12
  const diametros =
    meses >= adultoDesde
      ? (
          db
            .prepare(
              `SELECT json_extract(antropometria, '$.diametros') AS d FROM control
               WHERE paciente_id = ? AND gasto IS NOT NULL AND edad_meses >= ? AND json_extract(antropometria, '$.diametros') NOT IN ('{}')
               ORDER BY fecha DESC, id DESC LIMIT 1`
            )
            .get(pacienteId, adultoDesde) as { d: string } | undefined
        )?.d
      : undefined
  const anterior = db
    .prepare(
      `SELECT id, talla_cm AS tallaCm, formula_id AS formulaId, modo_met AS modo, met_reposo AS metReposo, eta, estado_fisiologico AS estado,
         objetivo_calorico AS objetivoCalorico, ajuste_pct AS ajustePct, alergias, intolerancias, enfermedades, medicamentos, examenes, pauta
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
        objetivoCalorico: string
        ajustePct: number
        alergias: string
        intolerancias: string
        enfermedades: string
        medicamentos: string
        examenes: string
        pauta: string
      }
    | undefined
  const base = anterior ?? {
    tallaCm: null,
    formulaId: meses >= 19 * 12 ? predeterminado.formulaAdulto : predeterminado.formulaMenor,
    modo: predeterminado.modo,
    metReposo: predeterminado.metReposo,
    eta: predeterminado.eta ? 1 : 0,
    estado: null,
    objetivoCalorico: 'normo',
    ajustePct: 0,
    alergias: '',
    intolerancias: '',
    enfermedades: '',
    medicamentos: '',
    examenes: '[]',
    pauta: '{}'
  }

  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO control (paciente_id, profesional_id, fecha, edad_meses, talla_cm, formula_id, modo_met, met_reposo, eta, estado_fisiologico,
             objetivo_calorico, ajuste_pct, alergias, intolerancias, enfermedades, medicamentos, examenes, pauta, antropometria)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          base.objetivoCalorico,
          base.ajustePct,
          base.alergias,
          base.intolerancias,
          base.enfermedades,
          base.medicamentos,
          base.examenes,
          base.pauta,
          diametros ? `{"diametros":${diametros}}` : '{}'
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
         estado_fisiologico AS estado, semana_embarazo AS semanaEmbarazo, objetivo_calorico AS objetivoCalorico, ajuste_pct AS ajustePct, motivo, notas,
         alergias, intolerancias, enfermedades, medicamentos, examenes, antropometria, recordatorio, pauta, gasto
       FROM control WHERE id = ?`
    )
    .get(id) as
    | (Omit<Control, 'eta' | 'gasto' | 'semana' | 'examenes' | 'antropometria' | 'recordatorio' | 'pauta'> & {
        eta: number
        gasto: string | null
        examenes: string
        antropometria: string
        recordatorio: string
        pauta: string
      })
    | undefined
  if (!c) throw new Error('Control no encontrado')
  const semana: Control['semana'] = [[], [], [], [], [], [], []]
  const bloques = db
    .prepare('SELECT dia, actividad_id AS actividadId, nombre, met, minutos FROM rutina_bloque WHERE control_id = ? ORDER BY id')
    .all(id) as ({ dia: number } & Control['semana'][number][number])[]
  for (const { dia, ...b } of bloques) semana[dia].push(b)
  return {
    ...c,
    eta: c.eta === 1,
    gasto: c.gasto ? JSON.parse(c.gasto) : null,
    examenes: JSON.parse(c.examenes),
    antropometria: { ...medidasVacias(), ...JSON.parse(c.antropometria) },
    recordatorio: { comidas: [], noConsume: [], ...JSON.parse(c.recordatorio) },
    pauta: { ...pautaVacia(), ...JSON.parse(c.pauta) },
    semana
  }
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
  if (c.semanaEmbarazo !== null && !c.estado?.startsWith('gestacion')) throw new Error('La semana de gestación solo aplica en gestación')
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
    semanaEmbarazo: x.semanaEmbarazo,
    objetivoCalorico: x.objetivoCalorico,
    ajustePct: x.ajustePct,
    motivo: x.motivo,
    notas: x.notas,
    alergias: x.alergias,
    intolerancias: x.intolerancias,
    enfermedades: x.enfermedades,
    medicamentos: x.medicamentos,
    examenes: JSON.stringify(x.examenes),
    antropometria: JSON.stringify(x.antropometria),
    recordatorio: JSON.stringify(x.recordatorio),
    pauta: JSON.stringify(x.pauta),
    tmb: x.gasto?.tmb,
    gastoPromedio: x.gasto?.promedio
  })

  const insertar = db.prepare(
    'INSERT INTO rutina_bloque (control_id, dia, actividad_id, nombre, met, minutos) VALUES (?, ?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    db.prepare(
      `UPDATE control SET fecha = ?, edad_meses = ?, peso_kg = ?, talla_cm = ?, masa_libre_grasa_kg = ?, formula_id = ?, tmb_manual = ?,
         modo_met = ?, met_reposo = ?, eta = ?, estado_fisiologico = ?, semana_embarazo = ?, objetivo_calorico = ?, ajuste_pct = ?, motivo = ?, notas = ?,
         alergias = ?, intolerancias = ?, enfermedades = ?, medicamentos = ?, examenes = ?, antropometria = ?, recordatorio = ?, pauta = ?, gasto = ? WHERE id = ?`
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
      c.semanaEmbarazo,
      c.objetivoCalorico,
      c.ajustePct,
      c.motivo,
      c.notas,
      c.alergias,
      c.intolerancias,
      c.enfermedades,
      c.medicamentos,
      JSON.stringify(c.examenes),
      JSON.stringify(c.antropometria),
      JSON.stringify(c.recordatorio),
      JSON.stringify(c.pauta),
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
