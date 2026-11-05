import type { ExportacionPaciente, Paciente, PacienteGuardar, PacienteResumen, Perfil } from '../shared/contratos'
import * as controles from './controles'
import { auditar, type DB } from './db'

const SELECT = `SELECT id, rut, nombres, apellidos, fecha_nacimiento AS fechaNacimiento, sexo, perfil, disciplina,
  semanas_gestacion AS semanasGestacion, peso_nacer_g AS pesoNacerG, direccion, telefono, correo, preferencia, sintomas, tabaco, alcohol,
  objetivo, tutor_nombre AS tutorNombre, consentimiento_fecha AS consentimientoFecha FROM paciente`

export function listar(db: DB, busqueda: string, perfil: Perfil | null): PacienteResumen[] {
  // ponytail: LIKE sin paginación ni acentos; buscar "jose" no encuentra "José". FTS5 si el listado crece.
  return db
    .prepare(
      `SELECT id, rut, nombres || ' ' || apellidos AS nombre, fecha_nacimiento AS fechaNacimiento, sexo, perfil
       FROM paciente
       WHERE (nombres || ' ' || apellidos LIKE @texto OR ifnull(rut, '') LIKE @rut)
         AND (@perfil IS NULL OR perfil = @perfil)
       ORDER BY apellidos, nombres
       LIMIT 500`
    )
    .all({ texto: `%${busqueda}%`, rut: `%${busqueda.replace(/\./g, '')}%`, perfil }) as PacienteResumen[]
}

export function obtener(db: DB, id: number): Paciente {
  const fila = db.prepare(`${SELECT} WHERE id = ?`).get(id) as
    | (Omit<Paciente, 'consentimiento' | 'sintomas'> & { sintomas: string })
    | undefined
  if (!fila) throw new Error('Paciente no encontrado')
  return { ...fila, sintomas: JSON.parse(fila.sintomas), consentimiento: true }
}

/** Crea o actualiza; cada campo cambiado queda en auditoría con su valor anterior. */
export function guardar(db: DB, p: PacienteGuardar, profesionalId: number): Paciente {
  const campos = {
    rut: p.rut,
    nombres: p.nombres,
    apellidos: p.apellidos,
    fechaNacimiento: p.fechaNacimiento,
    sexo: p.sexo,
    semanasGestacion: p.semanasGestacion,
    pesoNacerG: p.pesoNacerG,
    perfil: p.perfil,
    disciplina: p.disciplina,
    direccion: p.direccion,
    telefono: p.telefono,
    correo: p.correo,
    preferencia: p.preferencia,
    sintomas: JSON.stringify(p.sintomas),
    tabaco: p.tabaco,
    alcohol: p.alcohol,
    objetivo: p.objetivo,
    tutorNombre: p.tutorNombre
  }
  const columnas = `rut = @rut, nombres = @nombres, apellidos = @apellidos, fecha_nacimiento = @fechaNacimiento,
    sexo = @sexo, semanas_gestacion = @semanasGestacion, peso_nacer_g = @pesoNacerG,
    perfil = @perfil, disciplina = @disciplina, direccion = @direccion, telefono = @telefono, correo = @correo,
    preferencia = @preferencia, sintomas = @sintomas, tabaco = @tabaco, alcohol = @alcohol, objetivo = @objetivo,
    tutor_nombre = @tutorNombre`

  if (p.id === undefined) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO paciente (profesional_id, consentimiento_fecha, rut, nombres, apellidos, fecha_nacimiento, sexo, semanas_gestacion, peso_nacer_g,
           perfil, disciplina, direccion, telefono, correo, preferencia, sintomas, tabaco, alcohol, objetivo, tutor_nombre)
         VALUES (@profesionalId, date('now', 'localtime'), @rut, @nombres, @apellidos, @fechaNacimiento, @sexo, @semanasGestacion, @pesoNacerG,
           @perfil, @disciplina, @direccion, @telefono, @correo, @preferencia, @sintomas, @tabaco, @alcohol, @objetivo, @tutorNombre)`
      )
      .run({ ...campos, profesionalId })
    return obtener(db, Number(lastInsertRowid))
  }

  const id = p.id
  const anterior = obtener(db, id)
  db.transaction(() => {
    db.prepare(`UPDATE paciente SET ${columnas} WHERE id = @id`).run({ ...campos, id })
    auditar(db, 'paciente', id, profesionalId, { ...anterior, sintomas: JSON.stringify(anterior.sintomas) }, campos)
  })()
  return obtener(db, id)
}

// Historial de cambios del paciente y de sus controles: guarda valores anteriores, así que también son sus datos.
const SU_AUDITORIA = `(tabla = 'paciente' AND registro_id = @id) OR (tabla = 'control' AND registro_id IN (SELECT id FROM control WHERE paciente_id = @id))`

/** Todos los datos del paciente: ficha, controles completos e historial de cambios. */
export function exportar(db: DB, id: number): ExportacionPaciente {
  const paciente = obtener(db, id)
  const ids = db.prepare('SELECT id FROM control WHERE paciente_id = ? ORDER BY fecha, id').pluck().all(id) as number[]
  return {
    sistema: 'Sistema Nutri',
    generado: new Date().toISOString(),
    paciente,
    controles: ids.map((c) => controles.obtener(db, c)),
    auditoria: db
      .prepare(
        `SELECT fecha, tabla, registro_id AS registroId, campo, valor_anterior AS valorAnterior, valor_nuevo AS valorNuevo
         FROM auditoria WHERE ${SU_AUDITORIA} ORDER BY id`
      )
      .all({ id }) as ExportacionPaciente['auditoria']
  }
}

/**
 * Elimina al paciente a su pedido: ficha, controles con sus rutinas e historial de cambios, sobrescritos en el archivo (secure_delete).
 * En auditoría queda solo que se eliminó, quién y cuándo, sin sus datos. Los respaldos anteriores los conservan hasta que roten.
 */
export function eliminar(db: DB, id: number, profesionalId: number): void {
  obtener(db, id) // falla si no existe
  db.transaction(() => {
    const n = db.prepare('SELECT count(*) FROM control WHERE paciente_id = ?').pluck().get(id) as number
    db.prepare(`DELETE FROM auditoria WHERE ${SU_AUDITORIA}`).run({ id })
    db.prepare('DELETE FROM control WHERE paciente_id = ?').run(id) // rutina_bloque se borra en cascada
    db.prepare('DELETE FROM paciente WHERE id = ?').run(id)
    db.prepare(
      `INSERT INTO auditoria (tabla, registro_id, profesional_id, campo, valor_anterior, valor_nuevo) VALUES ('paciente', ?, ?, 'eliminado a pedido', ?, NULL)`
    ).run(id, profesionalId, `${n} controles`)
  })()
}
