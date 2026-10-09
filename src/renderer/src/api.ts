import type { ZodType } from 'zod'
import type { ApiNutri, Canal, Entrada, Salidas } from '../../shared/contratos'

declare global {
  interface Window {
    nutri: ApiNutri
  }
}

/** Llama a un canal del backend; lanza Error con el mensaje legible si falla. */
export async function llamar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Salidas[C]> {
  const r = await window.nutri.invocar(canal, entrada)
  if (!r.ok) throw new Error(r.error)
  return r.datos
}

/** Validación de @mantine/form con el mismo esquema Zod que usa el backend. */
export function validarCon(esquema: ZodType) {
  return (valores: unknown) => {
    const r = esquema.safeParse(valores)
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
  }
}
