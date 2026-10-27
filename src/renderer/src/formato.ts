// Formato de números y fechas para mostrar en pantalla (es-CL).
export const fechaCL = (iso: string) => iso.split('-').reverse().join('-')
export const decimal = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })
export const kilos = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const kcal = (n: number) => `${Math.round(n).toLocaleString('es-CL')} kcal`
/** Puntaje Z con signo: +1,26, −0,05. */
export const puntajeZ = (z: number) => z.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
