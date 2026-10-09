// Funciones puras compartidas por frontend, backend y pruebas.

export function limpiarRut(rut: string): string {
  return rut.replace(/[.\s-]/g, '').toUpperCase()
}

/** Valida el dígito verificador (módulo 11) de un RUT chileno. */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut)
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return false
  const cuerpo = limpio.slice(0, -1)
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const resto = 11 - (suma % 11)
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === limpio.slice(-1)
}

/** Formato de almacenamiento: 12345678-5 (sin puntos). */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut)
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return new Date().toLocaleDateString('sv-SE')
}

/** Edad cumplida en años a una fecha dada (ambas YYYY-MM-DD). */
export function edadEnAnios(nacimiento: string, alDia: string): number {
  const [na, nm, nd] = nacimiento.split('-').map(Number)
  const [aa, am, ad] = alDia.split('-').map(Number)
  return aa - na - (am < nm || (am === nm && ad < nd) ? 1 : 0)
}
