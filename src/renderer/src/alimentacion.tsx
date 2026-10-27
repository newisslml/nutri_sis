// Alimentación del control (hoja 24H-REQ de la ficha maestra): recordatorio de 24 horas, requerimientos por día
// y armador de la pauta con porciones de intercambio por tiempo de comida.
import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  CloseButton,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core'
import { useMemo, useState } from 'react'
import { DIAS, type ResultadoGasto } from '../../calculo/gasto'
import {
  CODIGOS,
  GRUPOS_INTERCAMBIO,
  TIEMPOS_COMIDA,
  cambioEstimadoKgMes,
  hidratacion,
  metaKcal,
  requerimientoDia,
  sumarMacros,
  totalPorciones,
  type CodigoGrupo,
  type Macros,
  type ObjetivoCalorico,
  type Porciones,
  type Requerimiento
} from '../../calculo/intercambio'
import type { Paciente, Pauta, Recordatorio } from '../../shared/contratos'
import { decimal, fechaCL, kcal } from './formato'
import { OBJETIVOS, RECOMENDACIONES, REGIMENES, SUPLEMENTOS, preparacionesPara } from './textos-pauta'

const gramos = (n: number) => `${Math.round(n).toLocaleString('es-CL')} g`
const pct = (fraccion: number) => `${Math.round(fraccion * 100)} %`

/** Fecha ISO más n días, sin desfase por zona horaria. */
export function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

export type Objetivo = { objetivo: ObjetivoCalorico; ajustePct: number }

/** Requerimiento de cada día según el gasto (congelado o en vivo), el objetivo calórico y los g/kg de la pauta. */
export function requerimientosSemana(gasto: ResultadoGasto, o: Objetivo, pesoKg: number, p: Pick<Pauta, 'protGKg' | 'lipGKg'>): Requerimiento[] {
  return gasto.porDia.map((k) => requerimientoDia({ kcal: metaKcal(k, o.objetivo, o.ajustePct), pesoKg, protGKg: p.protGKg, lipGKg: p.lipGKg }))
}

export const totalComidas = (comidas: { porciones: Porciones }[]) => sumarMacros(comidas.map((c) => totalPorciones(c.porciones)))

/** "2.150 kcal · CHO 250 g (47 %) · …": distribución de una ingesta o de un día de la pauta. */
export function ResumenMacros({ m, pesoKg }: { m: Macros; pesoKg: number | null }) {
  const vct = (g: number, kcalPorGramo: number) => (m.kcal > 0 ? ` (${pct((g * kcalPorGramo) / m.kcal)})` : '')
  return (
    <Text size="sm">
      <b>{kcal(m.kcal)}</b> · Carbohidratos {gramos(m.cho)}
      {vct(m.cho, 4)} · Lípidos {gramos(m.lip)}
      {vct(m.lip, 9)} · Proteínas {gramos(m.prot)}
      {vct(m.prot, 4)}
      {pesoKg ? ` · ${decimal(m.prot / pesoKg)} g/kg de proteína` : ''}
    </Text>
  )
}

/** % de lo planificado o ingerido respecto de la meta: verde ±10 %, amarillo ±20 %, rojo fuera de eso. */
function Adecuacion({ real, meta }: { real: Macros; meta: Macros }) {
  const nombres: [keyof Macros, string][] = [
    ['kcal', 'Energía'],
    ['cho', 'Carbohidratos'],
    ['lip', 'Lípidos'],
    ['prot', 'Proteínas']
  ]
  return (
    <Group gap="xs">
      {nombres.map(([k, nombre]) => {
        const r = meta[k] > 0 ? real[k] / meta[k] : null
        const desvio = r === null ? Infinity : Math.abs(r - 1)
        return (
          <Badge key={k} variant="light" color={r === null ? 'gray' : desvio <= 0.1 ? 'green' : desvio <= 0.2 ? 'yellow' : 'red'}>
            {nombre} {r === null ? '—' : pct(r)}
          </Badge>
        )
      })}
    </Group>
  )
}

/** Déficit, normocalórico o superávit en % sobre el gasto; vale para los 7 días (24H-REQ B46). */
export function PanelObjetivo({ objetivo, ajustePct, gasto, onChange }: Objetivo & { gasto: ResultadoGasto | null; onChange: (o: Objetivo) => void }) {
  const meta = gasto ? metaKcal(gasto.promedio, objetivo, ajustePct) : 0
  return (
    <>
      <SegmentedControl
        fullWidth
        data={[
          { value: 'deficit', label: 'Déficit' },
          { value: 'normo', label: 'Normocalórico' },
          { value: 'superavit', label: 'Superávit' }
        ]}
        value={objetivo}
        onChange={(v) => onChange({ objetivo: v as ObjetivoCalorico, ajustePct: v === 'normo' ? 0 : ajustePct })}
      />
      <NumberInput
        mt="sm"
        label="Porcentaje respecto al GET"
        suffix=" %"
        allowDecimal={false}
        allowNegative={false}
        max={50}
        disabled={objetivo === 'normo'}
        value={ajustePct}
        onChange={(v) => onChange({ objetivo, ajustePct: Number(v) })}
      />
      {gasto && (
        <Stack gap="sm" mt="md">
          <Text>
            Meta: <b>{kcal(meta)}/día</b>
            <Text span c="dimmed" size="sm">
              {' '}
              · {objetivo === 'normo' ? 'igual al GET' : `GET ${objetivo === 'deficit' ? '−' : '+'} ${ajustePct} % (${kcal(Math.abs(meta - gasto.promedio))})`}
            </Text>
          </Text>
          {meta < gasto.tmb && <Alert color="yellow">La meta queda bajo la TMB ({kcal(gasto.tmb)})</Alert>}
        </Stack>
      )}
    </>
  )
}

type Fila = { tiempo: string; hora: string; porciones: Porciones }
type Sugerencias = { group: string; items: string[] }[]

/** Una comida por fila con sus porciones por grupo y sus kcal y macros en vivo; debajo de cada una, su texto libre. */
function TablaPorciones<F extends Fila>({
  filas,
  onChange,
  nueva,
  texto,
  kcalDia
}: {
  filas: F[]
  onChange: (filas: F[]) => void
  nueva: (tiempo: string) => F
  texto: { valor: (f: F) => string; cambiar: (f: F, v: string) => F; placeholder: string; sugerencias?: Sugerencias }
  kcalDia?: number
}) {
  const ordenar = (lista: F[]) => [...lista].sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'))
  const cambiarFila = (i: number, f: F, reordenar = false) => {
    const lista = filas.map((x, j) => (j === i ? f : x))
    onChange(reordenar ? ordenar(lista) : lista)
  }
  const cambiarPorcion = (i: number, c: CodigoGrupo, v: number | string) =>
    cambiarFila(i, { ...filas[i], porciones: { ...filas[i].porciones, [c]: v === '' ? undefined : Number(v) } })
  const macros = filas.map((f) => totalPorciones(f.porciones))
  const total = sumarMacros(macros)
  const separador = { borderBottom: '1px solid var(--table-border-color)' }

  return (
    <>
      <Table.ScrollContainer minWidth={1150}>
        <Table withRowBorders={false} verticalSpacing={4} horizontalSpacing={4}>
          <Table.Thead>
            <Table.Tr style={separador}>
              <Table.Th w={150}>Tiempo</Table.Th>
              <Table.Th w={104}>Hora</Table.Th>
              {CODIGOS.map((c) => (
                <Table.Th key={c} ta="center">
                  <Tooltip label={GRUPOS_INTERCAMBIO[c].nombre}>
                    <span>{c}</span>
                  </Tooltip>
                </Table.Th>
              ))}
              <Table.Th ta="right">kcal</Table.Th>
              <Table.Th ta="right">CHO</Table.Th>
              <Table.Th ta="right">Líp</Table.Th>
              <Table.Th ta="right">Prot</Table.Th>
              {kcalDia !== undefined && (
                <Table.Th ta="right">
                  <Tooltip label="Parte de la meta del día">
                    <span>% día</span>
                  </Tooltip>
                </Table.Th>
              )}
              <Table.Th w={32} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.flatMap((f, i) => [
              <Table.Tr key={`${i}-p`}>
                <Table.Td>
                  <Autocomplete size="xs" data={TIEMPOS_COMIDA} value={f.tiempo} onChange={(v) => cambiarFila(i, { ...f, tiempo: v })} />
                </Table.Td>
                <Table.Td>
                  <TextInput size="xs" type="time" value={f.hora} onChange={(e) => cambiarFila(i, { ...f, hora: e.currentTarget.value }, true)} />
                </Table.Td>
                {CODIGOS.map((c) => (
                  <Table.Td key={c}>
                    <NumberInput
                      size="xs"
                      w={52}
                      hideControls
                      decimalSeparator=","
                      decimalScale={2}
                      allowNegative={false}
                      max={20}
                      aria-label={`${GRUPOS_INTERCAMBIO[c].nombre}, ${f.tiempo || 'comida'}`}
                      value={f.porciones[c] ?? ''}
                      onChange={(v) => cambiarPorcion(i, c, v)}
                    />
                  </Table.Td>
                ))}
                <Table.Td ta="right">{Math.round(macros[i].kcal)}</Table.Td>
                <Table.Td ta="right">{Math.round(macros[i].cho)}</Table.Td>
                <Table.Td ta="right">{Math.round(macros[i].lip)}</Table.Td>
                <Table.Td ta="right">{Math.round(macros[i].prot)}</Table.Td>
                {kcalDia !== undefined && <Table.Td ta="right">{kcalDia > 0 ? pct(macros[i].kcal / kcalDia) : '—'}</Table.Td>}
                <Table.Td>
                  <CloseButton size="sm" aria-label="Quitar comida" onClick={() => onChange(filas.filter((_, j) => j !== i))} />
                </Table.Td>
              </Table.Tr>,
              <Table.Tr key={`${i}-t`} style={separador}>
                <Table.Td colSpan={CODIGOS.length + 8}>
                  <Autocomplete
                    size="xs"
                    placeholder={texto.placeholder}
                    data={texto.sugerencias ?? []}
                    limit={60}
                    maxDropdownHeight={280}
                    value={texto.valor(f)}
                    onChange={(v) => cambiarFila(i, texto.cambiar(f, v))}
                  />
                </Table.Td>
              </Table.Tr>
            ])}
            {filas.length > 0 && (
              <Table.Tr fw={700}>
                <Table.Td colSpan={2 + CODIGOS.length} ta="right">
                  Total
                </Table.Td>
                <Table.Td ta="right">{Math.round(total.kcal)}</Table.Td>
                <Table.Td ta="right">{Math.round(total.cho)}</Table.Td>
                <Table.Td ta="right">{Math.round(total.lip)}</Table.Td>
                <Table.Td ta="right">{Math.round(total.prot)}</Table.Td>
                {kcalDia !== undefined && <Table.Td ta="right">{kcalDia > 0 ? pct(total.kcal / kcalDia) : '—'}</Table.Td>}
                <Table.Td />
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Button
        variant="light"
        mt="sm"
        onClick={() => onChange(ordenar([...filas, nueva(TIEMPOS_COMIDA.find((t) => !filas.some((f) => f.tiempo === t)) ?? '')]))}
      >
        Agregar comida
      </Button>
    </>
  )
}

export function PestanaRecordatorio({
  valor,
  onChange,
  requerimiento,
  pesoKg,
  onUsarComoBase
}: {
  valor: Recordatorio
  onChange: (r: Recordatorio) => void
  requerimiento: Requerimiento | null
  pesoKg: number | null
  onUsarComoBase: () => void
}) {
  const ingesta = totalComidas(valor.comidas)
  return (
    <Stack>
      <Paper withBorder p="md">
        <Title order={4}>Recordatorio de 24 horas</Title>
        <Text size="sm" c="dimmed" mb="sm">
          Lo que comió el paciente el día anterior (o un día típico), en porciones de intercambio. Media porción: 0,5.
        </Text>
        <TablaPorciones
          filas={valor.comidas}
          onChange={(comidas) => onChange({ ...valor, comidas })}
          nueva={(tiempo) => ({ tiempo, hora: '', alimentos: '', porciones: {} })}
          texto={{
            valor: (f) => f.alimentos,
            cambiar: (f, alimentos) => ({ ...f, alimentos }),
            placeholder: 'Alimentos y preparaciones. Ej.: té con 2 rebanadas de pan con palta'
          }}
        />
        <MultiSelect
          mt="md"
          label="Grupos que no consume"
          data={CODIGOS.map((c) => ({ value: c, label: `${c} · ${GRUPOS_INTERCAMBIO[c].nombre}` }))}
          value={valor.noConsume}
          onChange={(v) => onChange({ ...valor, noConsume: v as CodigoGrupo[] })}
        />
      </Paper>
      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Ingesta estimada
        </Title>
        <ResumenMacros m={ingesta} pesoKg={pesoKg} />
        {requerimiento ? (
          <Group mt="sm" gap="sm">
            <Text size="sm" c="dimmed">
              Respecto al requerimiento promedio:
            </Text>
            <Adecuacion real={ingesta} meta={requerimiento} />
          </Group>
        ) : (
          <Text size="sm" c="dimmed" mt="sm">
            Ingrese el peso y la rutina para comparar con el requerimiento.
          </Text>
        )}
        <Button mt="md" variant="light" disabled={valor.comidas.length === 0} onClick={onUsarComoBase}>
          Usar como base del lunes en la pauta
        </Button>
      </Paper>
    </Stack>
  )
}

export function ArmadorPauta({
  pauta,
  onChange,
  gasto,
  pesoKg,
  objetivo,
  onCambiarObjetivo,
  fecha,
  preferencia
}: {
  pauta: Pauta
  onChange: (p: Pauta) => void
  gasto: ResultadoGasto | null
  pesoKg: number | null
  objetivo: Objetivo
  onCambiarObjetivo: (o: Objetivo) => void
  fecha: string
  preferencia: Paciente['preferencia']
}) {
  const [dia, setDia] = useState(0)
  const [destinos, setDestinos] = useState<string[]>([])
  const cambiar = (c: Partial<Pauta>) => onChange({ ...pauta, ...c })
  const cambiarDia = (comidas: Pauta['dias'][number]) => cambiar({ dias: pauta.dias.map((d, i) => (i === dia ? comidas : d)) })
  const copiarDia = () => {
    const indices = destinos.map(Number)
    cambiar({ dias: pauta.dias.map((d, i) => (indices.includes(i) ? pauta.dias[dia].map((c) => ({ ...c, porciones: { ...c.porciones } })) : d)) })
    setDestinos([])
  }

  const reqs = gasto && pesoKg ? requerimientosSemana(gasto, objetivo, pesoKg, pauta) : null
  const totales = pauta.dias.map(totalComidas)
  const agua = pesoKg ? hidratacion(pesoKg) : null
  const metaPromedio = reqs ? reqs.reduce((s, r) => s + r.kcal, 0) / 7 : null
  const sugerencias = useMemo<Sugerencias>(() => {
    const grupos = new Map<string, string[]>()
    for (const p of preparacionesPara(preferencia)) grupos.set(p.tipo, [...(grupos.get(p.tipo) ?? []), p.nombre])
    return [...grupos].map(([group, items]) => ({ group, items }))
  }, [preferencia])
  const catalogo = RECOMENDACIONES.flatMap((g) => g.items)
  const otras = pauta.recomendaciones.filter((t) => !catalogo.includes(t)) // guardadas con un texto que ya no está en el catálogo
  const proximo = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fechaCL(sumarDias(fecha, pauta.semanasProximo * 7)) : '—'

  return (
    <Stack>
      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Requerimientos por día
        </Title>
        <SimpleGrid cols={{ base: 1, md: 3 }} mb="md">
          <div>
            <PanelObjetivo {...objetivo} gasto={gasto} onChange={onCambiarObjetivo} />
          </div>
          <NumberInput
            label="Proteínas (g/kg de peso)"
            decimalSeparator=","
            decimalScale={2}
            step={0.1}
            min={0}
            max={4}
            value={pauta.protGKg}
            onChange={(v) => cambiar({ protGKg: Number(v) })}
          />
          <NumberInput
            label="Lípidos (g/kg de peso)"
            description="Los carbohidratos completan la meta"
            inputWrapperOrder={['label', 'input', 'description']}
            decimalSeparator=","
            decimalScale={2}
            step={0.1}
            min={0}
            max={3}
            value={pauta.lipGKg}
            onChange={(v) => cambiar({ lipGKg: Number(v) })}
          />
        </SimpleGrid>
        {!reqs || !gasto || !pesoKg ? (
          <Alert color="yellow">Ingrese el peso y la rutina para calcular los requerimientos.</Alert>
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Día</Table.Th>
                  <Table.Th ta="right">Gasto</Table.Th>
                  <Table.Th ta="right">Meta</Table.Th>
                  <Table.Th ta="right">Proteínas</Table.Th>
                  <Table.Th ta="right">Lípidos</Table.Th>
                  <Table.Th ta="right">Carbohidratos</Table.Th>
                  <Table.Th ta="right">CHO g/kg</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reqs.map((r, i) => (
                  <Table.Tr key={DIAS[i]} bg={i === dia ? 'var(--mantine-primary-color-light)' : undefined}>
                    <Table.Td>{DIAS[i]}</Table.Td>
                    <Table.Td ta="right">{kcal(gasto.porDia[i])}</Table.Td>
                    <Table.Td ta="right">{kcal(r.kcal)}</Table.Td>
                    <Table.Td ta="right">
                      {gramos(r.prot)} ({pct(r.pct.prot)})
                    </Table.Td>
                    <Table.Td ta="right">
                      {gramos(r.lip)} ({pct(r.pct.lip)})
                    </Table.Td>
                    <Table.Td ta="right" c={r.cho < 0 ? 'red' : undefined}>
                      {gramos(r.cho)} ({pct(r.pct.cho)})
                    </Table.Td>
                    <Table.Td ta="right">{decimal(r.choGKg)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {reqs.some((r) => r.cho < 0) && (
              <Alert color="red" mt="sm">
                Proteínas y lípidos superan la meta calórica: no quedan calorías para carbohidratos.
              </Alert>
            )}
            <Text size="sm" mt="sm">
              Agua: <b>{decimal(agua!.diaL)} L/día</b> ({Math.round(agua!.diaL / 0.25)} vasos de 250 ml) y {decimal(agua!.antesEjercicioL)} L 3 a
              4 horas antes del ejercicio
              {metaPromedio !== null && objetivo.objetivo !== 'normo' && (
                <>
                  {' '}
                  · Cambio estimado: {cambioEstimadoKgMes(gasto.promedio, metaPromedio) > 0 ? '−' : '+'}
                  {decimal(Math.abs(cambioEstimadoKgMes(gasto.promedio, metaPromedio)))} kg/mes
                </>
              )}
            </Text>
          </>
        )}
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Plan por día
        </Title>
        <Tabs value={String(dia)} onChange={(v) => setDia(Number(v))}>
          <Tabs.List>
            {DIAS.map((d, i) => (
              <Tabs.Tab key={d} value={String(i)}>
                {d.slice(0, 3)} · {kcal(totales[i].kcal)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <TablaPorciones
          filas={pauta.dias[dia]}
          onChange={cambiarDia}
          nueva={(tiempo) => ({ tiempo, hora: '', idea: '', porciones: {} })}
          kcalDia={reqs?.[dia].kcal ?? 0}
          texto={{
            valor: (f) => f.idea,
            cambiar: (f, idea) => ({ ...f, idea }),
            placeholder: 'Idea de preparación (opcional). Ej.: pollo al jugo c/ arroz graneado',
            sugerencias
          }}
        />
        <Stack gap="xs" mt="md">
          <ResumenMacros m={totales[dia]} pesoKg={pesoKg} />
          {reqs && (
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                Adecuación a la meta del {DIAS[dia].toLowerCase()}:
              </Text>
              <Adecuacion real={totales[dia]} meta={reqs[dia]} />
            </Group>
          )}
        </Stack>
        <Group mt="md" align="flex-end">
          <MultiSelect
            label={`Copiar ${DIAS[dia].toLowerCase()} a`}
            placeholder="Días"
            data={DIAS.map((d, i) => ({ value: String(i), label: d })).filter((o) => o.value !== String(dia))}
            value={destinos}
            onChange={setDestinos}
            w={360}
          />
          <Button variant="default" disabled={destinos.length === 0} onClick={copiarDia}>
            Copiar
          </Button>
        </Group>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Objetivos del plan
        </Title>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Próximo control
            </Text>
            <SegmentedControl
              data={[4, 6, 8].map((s) => ({ value: String(s), label: `${s} semanas` }))}
              value={String(pauta.semanasProximo)}
              onChange={(v) => cambiar({ semanasProximo: Number(v) as Pauta['semanasProximo'] })}
            />
            <Text size="sm" c="dimmed">
              Fecha aproximada: {proximo}
            </Text>
          </Stack>
          <Autocomplete label="Objetivo principal" data={OBJETIVOS} value={pauta.objetivo} onChange={(v) => cambiar({ objetivo: v })} />
          <MultiSelect label="Prescripción (régimen)" data={REGIMENES} value={pauta.regimen} onChange={(v) => cambiar({ regimen: v })} />
          <Textarea
            label="Metas específicas para el próximo control"
            autosize
            minRows={2}
            value={pauta.metas}
            onChange={(e) => cambiar({ metas: e.currentTarget.value })}
          />
        </SimpleGrid>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Recomendaciones
        </Title>
        <Checkbox.Group value={pauta.recomendaciones} onChange={(v) => cambiar({ recomendaciones: v })}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {[...RECOMENDACIONES, ...(otras.length ? [{ group: 'Guardadas con otro texto', items: otras }] : [])].map((g) => (
              <Stack key={g.group} gap={6}>
                <Text fw={600} size="sm">
                  {g.group}
                </Text>
                {g.items.map((t) => (
                  <Checkbox key={t} value={t} label={t} size="xs" />
                ))}
              </Stack>
            ))}
          </SimpleGrid>
        </Checkbox.Group>
        <Textarea
          mt="md"
          label="Comentario para el paciente"
          autosize
          minRows={2}
          value={pauta.comentario}
          onChange={(e) => cambiar({ comentario: e.currentTarget.value })}
        />
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          Suplementación
        </Title>
        {pauta.suplementos.length === 0 ? (
          <Text size="sm" c="dimmed">
            Sin suplementos.
          </Text>
        ) : (
          <Stack gap="xs">
            {pauta.suplementos.map((s, i) => (
              <Group key={i} align="flex-end" wrap="nowrap">
                <Select
                  label={i === 0 ? 'Producto' : undefined}
                  searchable
                  data={SUPLEMENTOS.map((x) => x.producto)}
                  value={s.producto || null}
                  onChange={(v) =>
                    cambiar({
                      suplementos: pauta.suplementos.map((x, j) =>
                        j === i ? { producto: v ?? '', dosis: x.dosis || (SUPLEMENTOS.find((y) => y.producto === v)?.dosis ?? '') } : x
                      )
                    })
                  }
                  w={300}
                />
                <TextInput
                  label={i === 0 ? 'Dosis' : undefined}
                  style={{ flex: 1 }}
                  value={s.dosis}
                  onChange={(e) => {
                    const dosis = e.currentTarget.value
                    cambiar({ suplementos: pauta.suplementos.map((x, j) => (j === i ? { ...x, dosis } : x)) })
                  }}
                />
                <CloseButton aria-label="Quitar suplemento" mb={8} onClick={() => cambiar({ suplementos: pauta.suplementos.filter((_, j) => j !== i) })} />
              </Group>
            ))}
          </Stack>
        )}
        <Button variant="light" mt="sm" onClick={() => cambiar({ suplementos: [...pauta.suplementos, { producto: '', dosis: '' }] })}>
          Agregar suplemento
        </Button>
      </Paper>
    </Stack>
  )
}
