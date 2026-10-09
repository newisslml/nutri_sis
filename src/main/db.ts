// Base SQLite cifrada en formato SQLCipher v4 (abrible con DB Browser for SQLite si hace falta).
// Migraciones: una entrada por cambio de esquema; PRAGMA user_version guarda cuántas se aplicaron.
import Database from 'better-sqlite3-multiple-ciphers'
import { copyFileSync, existsSync } from 'node:fs'

export type DB = Database.Database

const MIGRACIONES = [
  `CREATE TABLE profesional (
     id INTEGER PRIMARY KEY,
     nombre TEXT NOT NULL,
     registro TEXT NOT NULL DEFAULT ''
   );
   CREATE TABLE paciente (
     id INTEGER PRIMARY KEY,
     profesional_id INTEGER NOT NULL REFERENCES profesional(id),
     rut TEXT UNIQUE,
     nombres TEXT NOT NULL,
     apellidos TEXT NOT NULL,
     fecha_nacimiento TEXT NOT NULL,
     sexo TEXT NOT NULL CHECK (sexo IN ('F', 'M')),
     perfil TEXT NOT NULL,
     disciplina TEXT NOT NULL DEFAULT '',
     antecedentes TEXT NOT NULL DEFAULT '',
     objetivo TEXT NOT NULL DEFAULT '',
     tutor_nombre TEXT NOT NULL DEFAULT '',
     consentimiento_fecha TEXT NOT NULL,
     creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
   );
   CREATE TABLE auditoria (
     id INTEGER PRIMARY KEY,
     fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
     tabla TEXT NOT NULL,
     registro_id INTEGER NOT NULL,
     campo TEXT NOT NULL,
     valor_anterior TEXT,
     valor_nuevo TEXT
   );`
]

/** Abre (o crea) la base con la clave. Lanza error si la clave no corresponde. */
export function abrirBase(ruta: string, clave: Buffer): DB {
  const existia = existsSync(ruta)
  const db = new Database(ruta)
  try {
    db.pragma(`cipher = 'sqlcipher'`)
    db.pragma('legacy = 4')
    db.key(clave)
    const version = db.pragma('user_version', { simple: true }) as number // falla aquí si la clave es incorrecta
    db.pragma('foreign_keys = ON')
    if (version < MIGRACIONES.length) {
      if (existia) copyFileSync(ruta, `${ruta}.antes-v${version + 1}.bak`) // copia cifrada antes de migrar
      db.transaction(() => {
        for (const sql of MIGRACIONES.slice(version)) db.exec(sql)
        db.pragma(`user_version = ${MIGRACIONES.length}`)
      })()
    }
    return db
  } catch (e) {
    db.close()
    throw e
  }
}
