import type { Paciente, PacienteGuardar, PacienteResumen, Perfil } from '../shared/contratos'
import type { DB } from './db'

const SELECT = `SELECT id, rut, nombres, apellidos, fecha_nacimiento AS fechaNacimiento, sexo, perfil, disciplina,
  antecedentes, objetivo, tutor_nombre AS tutorNombre, consentimiento_fecha AS consentimientoFecha FROM paciente`

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
  const fila = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Omit<Paciente, 'consentimiento'> | undefined
  if (!fila) throw new Error('Paciente no encontrado')
  return { ...fila, consentimiento: true }
}

/** Crea o actualiza; cada campo cambiado queda en auditoría con su valor anterior. */
export function guardar(db: DB, p: PacienteGuardar, profesionalId: number): Paciente {
  const campos = {
    rut: p.rut,
    nombres: p.nombres,
    apellidos: p.apellidos,
    fechaNacimiento: p.fechaNacimiento,
    sexo: p.sexo,
    perfil: p.perfil,
    disciplina: p.disciplina,
    antecedentes: p.antecedentes,
    objetivo: p.objetivo,
    tutorNombre: p.tutorNombre
  }
  const columnas = `rut = @rut, nombres = @nombres, apellidos = @apellidos, fecha_nacimiento = @fechaNacimiento,
    sexo = @sexo, perfil = @perfil, disciplina = @disciplina, antecedentes = @antecedentes, objetivo = @objetivo,
    tutor_nombre = @tutorNombre`

  if (p.id === undefined) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO paciente (profesional_id, consentimiento_fecha, rut, nombres, apellidos, fecha_nacimiento, sexo, perfil,
           disciplina, antecedentes, objetivo, tutor_nombre)
         VALUES (@profesionalId, date('now', 'localtime'), @rut, @nombres, @apellidos, @fechaNacimiento, @sexo, @perfil,
           @disciplina, @antecedentes, @objetivo, @tutorNombre)`
      )
      .run({ ...campos, profesionalId })
    return obtener(db, Number(lastInsertRowid))
  }

  const id = p.id
  const anterior = obtener(db, id)
  const auditar = db.prepare(
    `INSERT INTO auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo) VALUES ('paciente', ?, ?, ?, ?)`
  )
  db.transaction(() => {
    db.prepare(`UPDATE paciente SET ${columnas} WHERE id = @id`).run({ ...campos, id })
    for (const [campo, nuevo] of Object.entries(campos)) {
      const viejo = anterior[campo as keyof typeof campos]
      if (viejo !== nuevo) auditar.run(id, campo, viejo, nuevo)
    }
  })()
  return obtener(db, id)
}
