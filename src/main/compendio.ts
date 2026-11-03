// Lee las tablas de los compendios MET en español (MET.md adulto, METy.md juvenil, MET60.md adulto mayor) para la semilla de actividad_met.
// Filas: | código | valor… | actividad |, con código y valor en *cursiva* cuando el valor es estimado; "—" = sin valor publicado.

export type ActividadSemilla = { codigo: string; categoria: string; nombre: string; valores: (number | null)[]; estimado: boolean }

const ENTIDADES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' }

export function parsearCompendio(md: string): ActividadSemilla[] {
  const actividades: ActividadSemilla[] = []
  let categoria = ''
  for (const linea of md.split(/\r?\n/)) {
    const titulo = linea.match(/^## (.+)/)
    if (titulo) categoria = titulo[1].trim()
    const celdas = linea.match(/^\|(.+)\|\s*$/)?.[1].split('|').map((c) => c.trim())
    const codigo = celdas?.[0].match(/^(\*?)(\d{5,7})\*?$/)
    if (celdas && codigo) {
      actividades.push({
        codigo: codigo[2],
        categoria,
        nombre: celdas.at(-1)!.replace(/&(lt|gt|amp);/g, (e) => ENTIDADES[e]),
        valores: celdas.slice(1, -1).map((v) => (v === '—' ? null : Number(v.replaceAll('*', '')))),
        estimado: codigo[1] === '*'
      })
    }
  }
  return actividades
}
