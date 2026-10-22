import { useEffect } from 'react'
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

// Cambios sin guardar de la pantalla abierta, para que el encabezado (Inicio, Bloquear) pregunte antes de salir.
let pendiente = false
export const confirmarSalida = () => !pendiente || window.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')
export function useCambiosPendientes(hay: boolean) {
  useEffect(() => {
    pendiente = hay
    return () => {
      pendiente = false
    }
  }, [hay])
}

/** Validación de @mantine/form con el mismo esquema Zod que usa el backend. */
export function validarCon(esquema: ZodType) {
  return (valores: unknown) => {
    const r = esquema.safeParse(valores)
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
  }
}
