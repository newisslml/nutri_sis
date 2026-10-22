// Base SQLite cifrada en formato SQLCipher v4 (abrible con DB Browser for SQLite si hace falta).
// Migraciones: una entrada por cambio de esquema; PRAGMA user_version guarda cuántas se aplicaron.
import Database from 'better-sqlite3-multiple-ciphers'
import { copyFileSync, existsSync } from 'node:fs'
import compendio from '../../MET.md?raw'
import { parsearCompendio } from './compendio'

export type DB = Database.Database

const FUENTE_COMPENDIO = 'Compendio de Actividades Físicas 2011 (Ainsworth BE et al. Med Sci Sports Exerc. 2011;43(8):1575-81)'

const MIGRACIONES: (string | ((db: DB) => void))[] = [
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
   );`,
  (db) => {
    db.exec(`
      CREATE TABLE actividad_met (
        id INTEGER PRIMARY KEY,
        codigo TEXT,
        categoria TEXT NOT NULL,
        nombre TEXT NOT NULL,
        met REAL NOT NULL CHECK (met > 0),
        estimado INTEGER NOT NULL DEFAULT 0,
        poblacion TEXT NOT NULL DEFAULT 'adulto',
        fuente TEXT NOT NULL
      );
      CREATE TABLE control (
        id INTEGER PRIMARY KEY,
        paciente_id INTEGER NOT NULL REFERENCES paciente(id),
        profesional_id INTEGER NOT NULL REFERENCES profesional(id),
        fecha TEXT NOT NULL,
        peso_kg REAL,
        talla_cm REAL,
        formula_id TEXT NOT NULL,
        modo_met TEXT NOT NULL,
        met_reposo REAL NOT NULL,
        eta INTEGER NOT NULL DEFAULT 0,
        estado_fisiologico TEXT,
        gasto TEXT, -- resultado congelado (JSON), con id y versión de la fórmula
        creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX control_paciente ON control (paciente_id, fecha);
      CREATE TABLE rutina_bloque (
        id INTEGER PRIMARY KEY,
        control_id INTEGER NOT NULL REFERENCES control(id) ON DELETE CASCADE,
        dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
        actividad_id INTEGER REFERENCES actividad_met(id),
        nombre TEXT NOT NULL, -- copia: el control no cambia si después se edita la tabla MET
        met REAL NOT NULL,
        minutos INTEGER NOT NULL
      );
      CREATE INDEX rutina_control ON rutina_bloque (control_id);`)
    const insertar = db.prepare(
      `INSERT INTO actividad_met (codigo, categoria, nombre, met, estimado, fuente)
       VALUES (@codigo, @categoria, @nombre, @met, @estimado, '${FUENTE_COMPENDIO}')`
    )
    for (const a of parsearCompendio(compendio)) insertar.run({ ...a, estimado: a.estimado ? 1 : 0 })
  },
  `ALTER TABLE control ADD COLUMN motivo TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN notas TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN tmb_manual REAL;
   ALTER TABLE control ADD COLUMN edad_meses INTEGER; -- congelada a la fecha del control
   ALTER TABLE auditoria ADD COLUMN profesional_id INTEGER REFERENCES profesional(id);`,
  'ALTER TABLE control ADD COLUMN masa_libre_grasa_kg REAL;',
  `ALTER TABLE control ADD COLUMN alergias TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN intolerancias TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN enfermedades TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN medicamentos TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN examenes TEXT NOT NULL DEFAULT '[]'; -- JSON [{fecha, detalle}]`,
  `ALTER TABLE paciente ADD COLUMN direccion TEXT NOT NULL DEFAULT '';
   ALTER TABLE paciente ADD COLUMN telefono TEXT NOT NULL DEFAULT '';
   ALTER TABLE paciente ADD COLUMN correo TEXT NOT NULL DEFAULT '';
   ALTER TABLE paciente ADD COLUMN preferencia TEXT;
   ALTER TABLE paciente ADD COLUMN sintomas TEXT NOT NULL DEFAULT '[]'; -- JSON con códigos de SINTOMAS
   ALTER TABLE paciente ADD COLUMN tabaco TEXT NOT NULL DEFAULT '';
   ALTER TABLE paciente ADD COLUMN alcohol TEXT NOT NULL DEFAULT '';
   ALTER TABLE control ADD COLUMN objetivo_calorico TEXT NOT NULL DEFAULT 'normo';
   ALTER TABLE control ADD COLUMN ajuste_pct INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE control ADD COLUMN antropometria TEXT NOT NULL DEFAULT '{}'; -- JSON {grupo: {sitio: valor}}, sitios en calculo/antropometria.ts`
]

/** Registra en auditoría cada campo cuyo valor cambió, con quién y cuándo. */
export function auditar(
  db: DB,
  tabla: string,
  registroId: number,
  profesionalId: number,
  antes: Record<string, unknown>,
  despues: Record<string, unknown>
): void {
  const texto = (v: unknown) => (v === null || v === undefined ? null : String(v))
  const insertar = db.prepare(
    'INSERT INTO auditoria (tabla, registro_id, profesional_id, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const [campo, nuevo] of Object.entries(despues)) {
    if (texto(antes[campo]) !== texto(nuevo)) insertar.run(tabla, registroId, profesionalId, campo, texto(antes[campo]), texto(nuevo))
  }
}

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
        for (const m of MIGRACIONES.slice(version)) {
          if (typeof m === 'string') db.exec(m)
          else m(db)
        }
        db.pragma(`user_version = ${MIGRACIONES.length}`)
      })()
    }
    return db
  } catch (e) {
    db.close()
    throw e
  }
}
