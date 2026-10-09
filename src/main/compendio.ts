// Lee las tablas de MET.md (Compendio de Actividades Físicas 2011, en español) para la semilla de actividad_met.
// Filas: | código | MET | actividad |, con código y MET en *cursiva* cuando el valor es estimado.

export type ActividadSemilla = { codigo: string; categoria: string; nombre: string; met: number; estimado: boolean }

const ENTIDADES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' }

export function parsearCompendio(md: string): ActividadSemilla[] {
  const actividades: ActividadSemilla[] = []
  let categoria = ''
  for (const linea of md.split(/\r?\n/)) {
    const titulo = linea.match(/^## (.+)/)
    if (titulo) categoria = titulo[1].trim()
    const fila = linea.match(/^\|\s*(\*?)(\d{5})\*?\s*\|\s*\*?([\d.]+)\*?\s*\|\s*(.+?)\s*\|\s*$/)
    if (fila) {
      actividades.push({
        codigo: fila[2],
        categoria,
        nombre: fila[4].replace(/&(lt|gt|amp);/g, (e) => ENTIDADES[e]),
        met: Number(fila[3]),
        estimado: fila[1] === '*'
      })
    }
  }
  return actividades
}
