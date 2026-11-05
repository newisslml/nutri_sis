import { CONFIGURACION_INICIAL, configuracion, type Configuracion } from '../shared/contratos'
import { auditar, type DB } from './db'

/** Lo guardado sobre los valores por defecto; un valor que ya no es válido (p. ej. una fórmula retirada) vuelve al por defecto. */
export function leer(db: DB): Configuracion {
  const c: Record<string, unknown> = { ...CONFIGURACION_INICIAL }
  for (const { clave, valor } of db.prepare('SELECT clave, valor FROM configuracion').all() as { clave: string; valor: string }[]) {
    const r = configuracion.shape[clave as keyof Configuracion]?.safeParse(JSON.parse(valor))
    if (r?.success) c[clave] = r.data
  }
  return c as Configuracion
}

export function guardar(db: DB, c: Configuracion, profesionalId: number): Configuracion {
  const anterior = leer(db)
  const escribir = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor')
  db.transaction(() => {
    for (const [clave, valor] of Object.entries(c)) escribir.run(clave, JSON.stringify(valor))
    auditar(db, 'configuracion', 0, profesionalId, anterior, c)
  })()
  return leer(db)
}
