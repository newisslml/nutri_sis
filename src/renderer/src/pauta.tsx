// Pauta que recibe el paciente en cada control (hoja PLAN de la ficha maestra, con el resumen del control como la hoja CTRL).
// Se ve en la pestaña Entrega y se guarda en PDF con printToPDF del proceso principal.
import { Alert, Anchor, Button, ColorSwatch, Group, List, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { bicompartimental, kerr, type Componente, type DatosAntropometria } from '../../calculo/antropometria'
import { estadoNutricional } from '../../calculo/clasificacion'
import { DIAS } from '../../calculo/gasto'
import { CODIGOS, GRUPOS_INTERCAMBIO, TIEMPOS_COMIDA, hidratacion, type Porciones, type Requerimiento } from '../../calculo/intercambio'
import type { Paciente, Pauta } from '../../shared/contratos'
import { formatearEdad } from '../../shared/validaciones'
import { sumarDias, totalComidas } from './alimentacion'
import { llamar } from './api'
import { decimal, fechaCL, kcal, kilos } from './formato'
import { GraficoEvolucion, colorCss } from './graficos'
import './impresion.css'
import type { PuntoEvolucion } from './informes'
import {
  ALIMENTOS_POR_GRUPO,
  ANTES_DE_COMENZAR,
  COMO_LEER,
  EQUIVALENTES_CER,
  MEDIDAS_CASERAS,
  NOTA_HIDRATACION,
  NOTA_REQUERIMIENTOS,
  PREGUNTAS_FRECUENTES,
  RECOMENDACIONES_GENERALES,
  SUPLEMENTOS,
  UTENSILIOS,
  VIDEO_PORCIONES,
  preparacionesPara
} from './textos-pauta'

const gramos = (n: number) => `${Math.round(n).toLocaleString('es-CL')} g`
const FRACCION: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' }
/** 1,5 → "1½", 0,5 → "½", 2 → "2" */
const cantidad = (n: number) => {
  const entero = Math.floor(n)
  const resto = FRACCION[String(Math.round((n - entero) * 100) / 100)]
  return resto ? `${entero || ''}${resto}` : decimal(n)
}
/** "1 CER · ½ FRT · 1 LMG" */
export const textoPorciones = (p: Porciones) =>
  CODIGOS.filter((c) => (p[c] ?? 0) > 0)
    .map((c) => `${cantidad(p[c]!)} ${c}`)
    .join(' · ')

/** Kerr si están todas sus medidas; si no, Durnin-Womersley con el músculo estimado. */
function composicion(d: DatosAntropometria): { metodo: string; nombreGrasa: string; grasa: Componente; musculo: Componente } | null {
  const k = kerr(d)
  if (!('faltan' in k)) return { metodo: 'Kerr, 5 componentes', nombreGrasa: 'Masa adiposa', grasa: k.resultado.adiposa, musculo: k.resultado.muscular }
  const b = bicompartimental(d)
  if (!('faltan' in b)) return { metodo: 'Durnin-Womersley', nombreGrasa: 'Masa grasa', grasa: b.resultado.grasa, musculo: b.resultado.muscular }
  return null
}

const Seccion = ({ titulo, salto, children }: { titulo: string; salto?: boolean; children: ReactNode }) => (
  <Paper withBorder p="md" className={salto ? 'pauta-seccion pauta-salto' : 'pauta-seccion'}>
    <Title order={3} mb="sm">
      {titulo}
    </Title>
    {children}
  </Paper>
)

type Props = {
  paciente: Paciente
  fecha: string
  edadMeses: number | null
  datos: DatosAntropometria | null
  evolucion: PuntoEvolucion[]
  pauta: Pauta
  requerimientos: Requerimiento[] | null
  sinGuardar: boolean
}

export function PautaPaciente({ paciente, fecha, edadMeses, datos, evolucion, pauta, requerimientos, sinGuardar }: Props) {
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined) })
  const nombre = `${paciente.nombres} ${paciente.apellidos}`
  const guardarPdf = useMutation({
    mutationFn: async () => {
      // El PDF sale siempre en modo claro, aunque la pantalla esté en modo oscuro.
      const raiz = document.documentElement
      const esquema = raiz.getAttribute('data-mantine-color-scheme')
      raiz.setAttribute('data-mantine-color-scheme', 'light')
      try {
        return await llamar('archivos.guardarPdf', { nombre: `Pauta ${nombre} ${fechaCL(fecha)}` })
      } finally {
        if (esquema) raiz.setAttribute('data-mantine-color-scheme', esquema)
      }
    }
  })

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  const actual = evolucion.findLastIndex((p) => p.fecha === fecha)
  const anterior = actual > 0 ? evolucion[actual - 1] : null
  const agua = datos ? hidratacion(datos.pesoKg) : null
  const usados = CODIGOS.filter((c) => pauta.dias.some((d) => d.some((x) => (x.porciones[c] ?? 0) > 0)))
  const ideas = new Map<string, string[]>()
  for (const p of preparacionesPara(paciente.preferencia)) ideas.set(p.tipo, [...(ideas.get(p.tipo) ?? []), p.nombre])

  // Filas de la grilla: los tiempos de comida de la semana, ordenados por la hora más temprana en que aparecen.
  const primeraHora = new Map<string, string>()
  for (const c of pauta.dias.flat()) {
    const h = c.hora || '99'
    if (!primeraHora.has(c.tiempo) || h < primeraHora.get(c.tiempo)!) primeraHora.set(c.tiempo, h)
  }
  const tiempos = [...primeraHora.keys()].sort(
    (a, b) => primeraHora.get(a)!.localeCompare(primeraHora.get(b)!) || TIEMPOS_COMIDA.indexOf(a) - TIEMPOS_COMIDA.indexOf(b)
  )

  return (
    <Stack>
      <Group data-no-imprimir>
        <Button onClick={() => guardarPdf.mutate()} loading={guardarPdf.isPending} disabled={sinGuardar || !datos}>
          Guardar PDF
        </Button>
        {sinGuardar && (
          <Text size="sm" c="dimmed">
            Guarde el control antes de generar el PDF, para que lo entregado quede registrado.
          </Text>
        )}
        {guardarPdf.data && <Text size="sm">PDF guardado en {guardarPdf.data}</Text>}
        {guardarPdf.error && <Alert color="red">{guardarPdf.error.message}</Alert>}
      </Group>

      {!datos ? (
        <Alert color="blue">Ingrese fecha, peso y talla en la pestaña Antropometría para armar la entrega.</Alert>
      ) : (
        <Stack data-imprimir>
          <Seccion titulo="Pauta de alimentación">
            <Text fw={600}>{nombre}</Text>
            <Text size="sm" c="dimmed">
              {[fechaValida && `Control del ${fechaCL(fecha)}`, edadMeses !== null && formatearEdad(edadMeses), sesion.data?.profesional]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Title order={4} mt="md" mb="xs">
              Antes de comenzar
            </Title>
            {ANTES_DE_COMENZAR.map((t) => (
              <Text key={t} size="sm" mb="xs">
                {t}
              </Text>
            ))}
            <Text size="sm">{UTENSILIOS.intro}</Text>
            <List size="sm" mt={4}>
              {UTENSILIOS.items.map((t) => (
                <List.Item key={t}>{t}</List.Item>
              ))}
            </List>
          </Seccion>

          <Seccion titulo="Tu control de hoy">
            <ControlDeHoy datos={datos} anterior={anterior?.datos ?? null} />
            {evolucion.length >= 2 && <EvolucionPeso puntos={evolucion} />}
          </Seccion>

          <Seccion titulo="Objetivos y requerimientos">
            <SimpleGrid cols={2} mb="md">
              <Dato titulo="Objetivo principal">{pauta.objetivo || '—'}</Dato>
              <Dato titulo="Prescripción">{pauta.regimen.join(', ') || '—'}</Dato>
              <Dato titulo="Próximo control">
                {fechaValida ? `${fechaCL(sumarDias(fecha, pauta.semanasProximo * 7))} (en ${pauta.semanasProximo} semanas)` : '—'}
              </Dato>
              <Dato titulo="Metas para el próximo control">{pauta.metas || '—'}</Dato>
            </SimpleGrid>
            {requerimientos && (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Lo que deberás comer</Table.Th>
                    <Table.Th ta="right">Calorías</Table.Th>
                    <Table.Th ta="right">Proteínas</Table.Th>
                    <Table.Th ta="right">Carbohidratos</Table.Th>
                    <Table.Th ta="right">Lípidos</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {requerimientos.map((r, i) => (
                    <Table.Tr key={DIAS[i]}>
                      <Table.Td>{DIAS[i]}</Table.Td>
                      <Table.Td ta="right">{kcal(r.kcal)}</Table.Td>
                      <Table.Td ta="right">{gramos(r.prot)}</Table.Td>
                      <Table.Td ta="right">{gramos(Math.max(0, r.cho))}</Table.Td>
                      <Table.Td ta="right">{gramos(r.lip)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              {NOTA_REQUERIMIENTOS}
            </Text>
            {agua && (
              <>
                <Title order={4} mt="md" mb="xs">
                  Hidratación
                </Title>
                <Table withTableBorder>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>Durante el día (mínimo)</Table.Td>
                      <Table.Td>
                        {decimal(agua.diaL)} L de agua ({Math.round(agua.diaL / 0.25)} vasos de 250 ml)
                      </Table.Td>
                      <Table.Td>Tomar libremente durante el día</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Antes del ejercicio</Table.Td>
                      <Table.Td>{decimal(agua.antesEjercicioL)} L de agua, 3 a 4 horas antes</Table.Td>
                      <Table.Td>Tomar junto a la comida previa</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
                <Text size="xs" c="dimmed" mt="xs">
                  {NOTA_HIDRATACION}
                </Text>
              </>
            )}
          </Seccion>

          <Seccion titulo="Plan de alimentación" salto>
            {tiempos.length === 0 ? (
              <Text size="sm" c="dimmed">
                La pauta aún no tiene comidas.
              </Text>
            ) : (
              <Table withTableBorder withColumnBorders className="pauta-grilla">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tiempo</Table.Th>
                    {DIAS.map((d) => (
                      <Table.Th key={d}>{d}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tiempos.map((t) => (
                    <Table.Tr key={t}>
                      <Table.Td fw={600}>
                        {t}
                        {primeraHora.get(t) !== '99' && (
                          <Text size="xs" c="dimmed">
                            {primeraHora.get(t)}
                          </Text>
                        )}
                      </Table.Td>
                      {pauta.dias.map((d, i) => (
                        <Table.Td key={DIAS[i]}>
                          {d
                            .filter((c) => c.tiempo === t)
                            .map((c, j) => (
                              <div key={j}>
                                <Text size="xs">{textoPorciones(c.porciones) || '—'}</Text>
                                {c.idea && (
                                  <Text size="xs" c="dimmed" fs="italic">
                                    {c.idea}
                                  </Text>
                                )}
                              </div>
                            ))}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td fw={600}>Total</Table.Td>
                    {pauta.dias.map((d, i) => (
                      <Table.Td key={DIAS[i]}>
                        <Text size="xs">{kcal(totalComidas(d).kcal)}</Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            )}
            <Title order={4} mt="md" mb="xs">
              Cómo leer tu plan
            </Title>
            <List size="sm" type="ordered" spacing={4}>
              {COMO_LEER.map((t) => (
                <List.Item key={t}>{t}</List.Item>
              ))}
            </List>
            <Text size="sm" mt="xs">
              Mira este video para comprender cómo hacer la lectura de las porciones de tu pauta: <Anchor href={VIDEO_PORCIONES}>{VIDEO_PORCIONES}</Anchor>
            </Text>
          </Seccion>

          <Seccion titulo="Porciones de intercambio" salto>
            {/* alignItems start: sin esto cada tabla se estira a la altura de su vecina y sus filas crecen */}
            <SimpleGrid cols={2} style={{ alignItems: 'start' }}>
              {(usados.length ? usados : CODIGOS).map((c) => (
                <TablaAlimentos key={c} titulo={`${GRUPOS_INTERCAMBIO[c].nombre} (${c})`} filas={ALIMENTOS_POR_GRUPO[c]} />
              ))}
            </SimpleGrid>
            <SimpleGrid cols={2} mt="md">
              <div>
                <Title order={4} mb="xs">
                  Medidas caseras
                </Title>
                <List size="sm">
                  {MEDIDAS_CASERAS.map((t) => (
                    <List.Item key={t}>{t}</List.Item>
                  ))}
                </List>
              </div>
              <div>
                <Title order={4} mb="xs">
                  Códigos de los grupos
                </Title>
                <Text size="sm">{CODIGOS.map((c) => `${c}: ${GRUPOS_INTERCAMBIO[c].nombre}`).join(' · ')}</Text>
              </div>
            </SimpleGrid>
          </Seccion>

          <Seccion titulo="Ideas rápidas para armar tus platos">
            <SimpleGrid cols={2}>
              {[...ideas].map(([tipo, lista]) => (
                <div key={tipo}>
                  <Text fw={600} size="sm" mb={4}>
                    {tipo}
                  </Text>
                  <List size="sm">
                    {lista.map((nombre) => (
                      <List.Item key={nombre}>{nombre}</List.Item>
                    ))}
                  </List>
                </div>
              ))}
            </SimpleGrid>
          </Seccion>

          {(pauta.recomendaciones.length > 0 || pauta.comentario) && (
            <Seccion titulo="Recomendaciones para ti">
              <List size="sm" spacing={4}>
                {pauta.recomendaciones.map((t) => (
                  <List.Item key={t}>{t}</List.Item>
                ))}
              </List>
              {pauta.comentario && (
                <Text size="sm" mt="sm" style={{ whiteSpace: 'pre-line' }}>
                  {pauta.comentario}
                </Text>
              )}
            </Seccion>
          )}

          {pauta.suplementos.length > 0 && (
            <Seccion titulo="Suplementación">
              <Stack gap="sm">
                {pauta.suplementos.map((s, i) => {
                  const info = SUPLEMENTOS.find((x) => x.producto === s.producto)
                  return (
                    <div key={i} className="pauta-bloque">
                      <Text fw={600} size="sm">
                        {s.producto} · {s.dosis || info?.dosis}
                      </Text>
                      {info && (
                        <Text size="sm">
                          {info.queEs} {info.paraQue} Cuándo: {info.cuando} Cómo: {info.como} Marcas recomendadas: {info.marcas}.
                        </Text>
                      )}
                    </div>
                  )
                })}
              </Stack>
            </Seccion>
          )}

          <Seccion titulo="Preguntas frecuentes y recomendaciones generales" salto>
            <Stack gap="sm">
              {PREGUNTAS_FRECUENTES.map(([p, r]) => (
                <div key={p} className="pauta-bloque">
                  <Text fw={600} size="sm">
                    {p}
                  </Text>
                  <Text size="sm">{r}</Text>
                </div>
              ))}
            </Stack>
            <TablaAlimentos titulo="Alimentos equivalentes a 1 CER" filas={EQUIVALENTES_CER} />
            <List size="sm" mt="md" spacing={4}>
              {RECOMENDACIONES_GENERALES.map((t) => (
                <List.Item key={t}>{t}</List.Item>
              ))}
            </List>
          </Seccion>
        </Stack>
      )}
    </Stack>
  )
}

const Dato = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed">
      {titulo}
    </Text>
    <Text size="sm" fw={600} style={{ whiteSpace: 'pre-line' }}>
      {children}
    </Text>
  </div>
)

function TablaAlimentos({ titulo, filas }: { titulo: string; filas: [string, string][] }) {
  return (
    <Table withTableBorder mt="sm" className="pauta-bloque">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{titulo}</Table.Th>
          <Table.Th>1 porción</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {filas.map(([alimento, porcion]) =>
          porcion ? (
            <Table.Tr key={alimento}>
              <Table.Td>{alimento}</Table.Td>
              <Table.Td>{porcion}</Table.Td>
            </Table.Tr>
          ) : (
            <Table.Tr key={alimento}>
              <Table.Td colSpan={2} fw={600}>
                {alimento}
              </Table.Td>
            </Table.Tr>
          )
        )}
      </Table.Tbody>
    </Table>
  )
}

/** Peso, talla, IMC y composición de hoy contra el control anterior con medidas. */
function ControlDeHoy({ datos, anterior }: { datos: DatosAntropometria; anterior: DatosAntropometria | null }) {
  const imc = (d: DatosAntropometria) => d.pesoKg / (d.tallaCm / 100) ** 2
  const hoy = composicion(datos)
  const antes = anterior && composicion(anterior)
  const estado = estadoNutricional(imc(datos), datos.edad)
  const diferencia = (a: number | undefined, b: number | undefined, unidad: string) => {
    if (a === undefined || b === undefined) return '—'
    const d = a - b
    return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${decimal(Math.abs(d))} ${unidad}`
  }
  const filas: [string, number | undefined, number | undefined, string][] = [
    ['Peso', datos.pesoKg, anterior?.pesoKg, 'kg'],
    ['Talla', datos.tallaCm, anterior?.tallaCm, 'cm'],
    ['IMC', imc(datos), anterior ? imc(anterior) : undefined, 'kg/m²'],
    ...(hoy
      ? ([
          [`${hoy.nombreGrasa} (%)`, hoy.grasa.pct, antes?.grasa.pct, '%'],
          [`${hoy.nombreGrasa} (kg)`, hoy.grasa.kg, antes?.grasa.kg, 'kg'],
          ['Masa muscular (kg)', hoy.musculo.kg, antes?.musculo.kg, 'kg']
        ] as [string, number, number | undefined, string][])
      : [])
  ]
  return (
    <>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th />
            <Table.Th ta="right">Hoy</Table.Th>
            {anterior && <Table.Th ta="right">Control anterior</Table.Th>}
            {anterior && <Table.Th ta="right">Diferencia</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map(([nombre, a, b, unidad]) => (
            <Table.Tr key={nombre}>
              <Table.Td>{nombre}</Table.Td>
              <Table.Td ta="right">{a === undefined ? '—' : `${decimal(a)} ${unidad}`}</Table.Td>
              {anterior && <Table.Td ta="right">{b === undefined ? '—' : `${decimal(b)} ${unidad}`}</Table.Td>}
              {anterior && <Table.Td ta="right">{diferencia(a, b, unidad)}</Table.Td>}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Text size="sm" mt="xs">
        {estado && `Estado nutricional según IMC: ${estado.etiqueta}. `}
        {hoy && `Composición corporal estimada con ${hoy.metodo}.`}
      </Text>
    </>
  )
}

function EvolucionPeso({ puntos }: { puntos: PuntoEvolucion[] }) {
  const comp = puntos.map((p) => composicion(p.datos))
  const series = [
    { nombre: 'Peso', color: 'blue.6', valores: puntos.map((p) => p.datos.pesoKg) },
    { nombre: 'Masa muscular', color: 'red.6', valores: comp.map((c) => c?.musculo.kg ?? null) },
    { nombre: 'Masa grasa o adiposa', color: 'yellow.6', valores: comp.map((c) => c?.grasa.kg ?? null) }
  ]
  return (
    <Stack gap="xs" mt="md" className="pauta-bloque">
      <Group gap="lg">
        {series.map((s) => (
          <Group gap={6} key={s.nombre}>
            <ColorSwatch size={12} color={colorCss(s.color)} />
            <Text size="sm">{s.nombre} (kg)</Text>
          </Group>
        ))}
      </Group>
      <GraficoEvolucion fechas={puntos.map((p) => p.fecha)} series={series} />
      <Text size="xs" c="dimmed">
        Último control: {kilos(puntos.at(-1)!.datos.pesoKg)} kg.
      </Text>
    </Stack>
  )
}
