import {
  Alert,
  Button,
  CloseButton,
  Grid,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  type ComboboxItem,
  type ComboboxParsedItemGroup,
  type OptionsFilter
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { FORMULAS, faltantes } from '../../calculo/formulas'
import { ADICIONAL, DIAS, calcularGastoSemanal, type EstadoFisiologico } from '../../calculo/gasto'
import { entradaGasto, type ActividadMet, type BloqueRutina, type Control, type ControlGuardar, type Paciente } from '../../shared/contratos'
import { edadEnAnios } from '../../shared/validaciones'
import { llamar } from './api'

const kcal = (n: number) => `${n.toLocaleString('es-CL')} kcal`
const horas = (minutos: number) => (minutos / 60).toLocaleString('es-CL', { maximumFractionDigits: 2 })
const numero = (v: number | string) => (v === '' ? null : Number(v))

const NOMBRE_ESTADO: Record<EstadoFisiologico, string> = {
  gestacion_t1: 'Gestación, 1.er trimestre',
  gestacion_t2: 'Gestación, 2.º trimestre',
  gestacion_t3: 'Gestación, 3.er trimestre',
  lactancia_0_6: 'Lactancia, 0 a 6 meses',
  lactancia_0_6_ganancia_insuficiente: 'Lactancia, 0 a 6 meses, ganancia gestacional insuficiente',
  lactancia_7_12: 'Lactancia, 7 a 12 meses'
}
const OPCIONES_ESTADO = (Object.keys(ADICIONAL) as EstadoFisiologico[]).map((e) => ({
  value: e,
  label: `${NOMBRE_ESTADO[e]} (+${ADICIONAL[e]} kcal)`
}))

// Búsqueda sin tildes y por palabras: "natacion libre" encuentra "Natación, estilo libre…"
const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const filtrarActividades: OptionsFilter = ({ options, search }) => {
  const palabras = sinTildes(search).split(/\s+/).filter(Boolean)
  return (options as ComboboxParsedItemGroup[])
    .map((g) => ({ ...g, items: g.items.filter((o) => palabras.every((p) => sinTildes(`${g.group} ${o.label}`).includes(p))) }))
    .filter((g) => g.items.length > 0)
}

export function ListaControles({ pacienteId }: { pacienteId: number }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const lista = useQuery({ queryKey: ['controles', pacienteId], queryFn: () => llamar('controles.listar', { pacienteId }) })
  const crear = useMutation({
    mutationFn: () => llamar('controles.crear', { pacienteId }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ['controles', pacienteId] })
      navegar(`/pacientes/${pacienteId}/controles/${id}`)
    }
  })

  return (
    <Stack maw={900}>
      <Group justify="space-between">
        <Title order={3}>Controles</Title>
        <Button onClick={() => crear.mutate()} loading={crear.isPending}>Nuevo control</Button>
      </Group>
      {crear.error && <Alert color="red">{crear.error.message}</Alert>}
      {lista.data?.length === 0 && <Text c="dimmed">Sin controles todavía.</Text>}
      {!!lista.data?.length && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Peso</Table.Th>
              <Table.Th>Gasto promedio</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lista.data.map((c) => (
              <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navegar(`/pacientes/${pacienteId}/controles/${c.id}`)}>
                <Table.Td>{c.fecha}</Table.Td>
                <Table.Td>{c.pesoKg === null ? '—' : `${c.pesoKg.toLocaleString('es-CL')} kg`}</Table.Td>
                <Table.Td>{c.promedioKcal === null ? 'Sin calcular' : kcal(c.promedioKcal)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

export function PantallaControl() {
  const { id, controlId } = useParams()
  const control = useQuery({ queryKey: ['control', controlId], queryFn: () => llamar('controles.obtener', { id: Number(controlId) }) })
  const paciente = useQuery({ queryKey: ['paciente', id], queryFn: () => llamar('pacientes.obtener', { id: Number(id) }) })
  const actividades = useQuery({ queryKey: ['met'], queryFn: () => llamar('catalogos.met', undefined), staleTime: Infinity })

  const error = control.error ?? paciente.error ?? actividades.error
  if (error) return <Alert color="red">{error.message}</Alert>
  if (!control.data || !paciente.data || !actividades.data) return <Loader />
  return <EditorControl key={control.data.id} inicial={control.data} paciente={paciente.data} actividades={actividades.data} />
}

type Borrador = Omit<Control, 'gasto' | 'pacienteId'>

function EditorControl({ inicial, paciente, actividades }: { inicial: Control; paciente: Paciente; actividades: ActividadMet[] }) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const [b, setB] = useState<Borrador>(() => {
    const { gasto: _g, pacienteId: _p, ...resto } = inicial
    return resto
  })
  const [guardado, setGuardado] = useState(() => JSON.stringify(b))
  const [dia, setDia] = useState(0)
  const [destinos, setDestinos] = useState<string[]>([])

  const porId = useMemo(() => new Map(actividades.map((a) => [a.id, a])), [actividades])
  const opciones = useMemo(() => {
    const grupos = new Map<string, ComboboxItem[]>()
    for (const a of actividades) {
      if (!grupos.has(a.categoria)) grupos.set(a.categoria, [])
      grupos.get(a.categoria)!.push({ value: String(a.id), label: `${a.nombre} · ${a.met.toLocaleString('es-CL')} MET` })
    }
    return [...grupos].map(([group, items]) => ({ group, items }))
  }, [actividades])

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha)
  const edad = fechaValida ? edadEnAnios(paciente.fechaNacimiento, b.fecha) : null
  const calculo = useMemo(() => {
    if (!b.pesoKg) return { error: 'Ingrese el peso para calcular el gasto' }
    if (!fechaValida) return { error: 'Ingrese la fecha del control' }
    try {
      return { resultado: calcularGastoSemanal(entradaGasto(b as ControlGuardar, paciente)) }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [b, paciente, fechaValida])

  const guardar = useMutation({
    mutationFn: () => llamar('controles.guardar', b as ControlGuardar),
    onSuccess: (r) => {
      qc.setQueryData(['control', String(r.id)], r)
      qc.invalidateQueries({ queryKey: ['controles', r.pacienteId] })
      setGuardado(JSON.stringify(b))
    }
  })

  const cambiar = (cambios: Partial<Borrador>) => setB((prev) => ({ ...prev, ...cambios }))
  const cambiarDia = (fn: (bloques: BloqueRutina[]) => BloqueRutina[]) =>
    setB((prev) => ({ ...prev, semana: prev.semana.map((d, i) => (i === dia ? fn(d) : d)) }))
  const copiarDia = () => {
    const indices = destinos.map(Number)
    setB((prev) => ({ ...prev, semana: prev.semana.map((d, i) => (indices.includes(i) ? prev.semana[dia].map((x) => ({ ...x })) : d)) }))
    setDestinos([])
  }

  const datosFormula = { pesoKg: b.pesoKg ?? 0, tallaCm: b.tallaCm ?? undefined, edad: edad ?? 0, sexo: paciente.sexo }
  const minutosDia = b.semana[dia].reduce((s, x) => s + x.minutos, 0)
  const r = calculo.resultado

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Control del {b.fecha}</Title>
          <Text c="dimmed">
            {paciente.nombres} {paciente.apellidos} · {edad ?? '—'} años al control · {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
          </Text>
        </div>
        <Group>
          <Button variant="default" onClick={() => navegar(`/pacientes/${paciente.id}`)}>Volver a la ficha</Button>
          <Button onClick={() => guardar.mutate()} loading={guardar.isPending} disabled={JSON.stringify(b) === guardado}>
            {JSON.stringify(b) === guardado ? 'Guardado' : 'Guardar'}
          </Button>
        </Group>
      </Group>
      {guardar.error && <Alert color="red">{guardar.error.message}</Alert>}

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack>
            <Paper withBorder p="md">
              <Group grow align="flex-start">
                <TextInput label="Fecha" type="date" value={b.fecha} onChange={(e) => cambiar({ fecha: e.currentTarget.value })} />
                <NumberInput label="Peso (kg)" decimalSeparator="," decimalScale={1} min={1} max={400} value={b.pesoKg ?? ''} onChange={(v) => cambiar({ pesoKg: numero(v) })} />
                <NumberInput label="Talla (cm)" decimalSeparator="," decimalScale={1} min={30} max={250} value={b.tallaCm ?? ''} onChange={(v) => cambiar({ tallaCm: numero(v) })} />
              </Group>
              <Group grow align="flex-start" mt="md">
                <Select
                  label="Fórmula de TMB"
                  allowDeselect={false}
                  data={FORMULAS.map((f) => ({ value: f.id, label: f.nombre, disabled: faltantes(f, datosFormula).length > 0 }))}
                  value={b.formulaId}
                  onChange={(v) => v && cambiar({ formulaId: v })}
                />
                <NumberInput
                  label="MET de reposo"
                  description="Para las horas sin actividad"
                  decimalSeparator=","
                  decimalScale={2}
                  step={0.05}
                  min={0.9}
                  max={3}
                  value={b.metReposo}
                  onChange={(v) => cambiar({ metReposo: Number(v) })}
                />
                {paciente.sexo === 'F' && (
                  <Select label="Gestación o lactancia" placeholder="No aplica" clearable data={OPCIONES_ESTADO} value={b.estado} onChange={(v) => cambiar({ estado: v as EstadoFisiologico | null })} />
                )}
              </Group>
              <Group mt="md">
                <SegmentedControl
                  data={[
                    { value: 'estandar', label: 'MET × peso × horas' },
                    { value: 'tmb', label: 'MET × TMB/24 × horas' }
                  ]}
                  value={b.modo}
                  onChange={(v) => cambiar({ modo: v as Borrador['modo'] })}
                />
                <Switch label="Sumar ETA (10 %)" checked={b.eta} onChange={(e) => cambiar({ eta: e.currentTarget.checked })} />
              </Group>
            </Paper>

            <Paper withBorder p="md">
              <Title order={4} mb="sm">Rutina semanal</Title>
              <Tabs value={String(dia)} onChange={(v) => setDia(Number(v))}>
                <Tabs.List>
                  {DIAS.map((d, i) => {
                    const total = b.semana[i].reduce((s, x) => s + x.minutos, 0)
                    return (
                      <Tabs.Tab key={d} value={String(i)} c={total > 1440 ? 'red' : undefined}>
                        {d.slice(0, 3)} · {horas(total)} h
                      </Tabs.Tab>
                    )
                  })}
                </Tabs.List>
              </Tabs>

              <Table mt="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Actividad</Table.Th>
                    <Table.Th w={110}>MET</Table.Th>
                    <Table.Th w={110}>Horas</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {b.semana[dia].map((bloque, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Select
                          searchable
                          placeholder="Buscar actividad"
                          data={opciones}
                          filter={filtrarActividades}
                          limit={80}
                          maxDropdownHeight={320}
                          value={bloque.actividadId === null ? null : String(bloque.actividadId)}
                          onChange={(v) => {
                            const a = v ? porId.get(Number(v)) : undefined
                            if (a) cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, actividadId: a.id, nombre: a.nombre, met: a.met } : x)))
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput decimalSeparator="," decimalScale={2} min={0.5} max={25} value={bloque.met} onChange={(v) => cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, met: Number(v) } : x)))} />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          decimalSeparator=","
                          decimalScale={2}
                          step={0.25}
                          min={0}
                          max={24}
                          value={bloque.minutos / 60}
                          onChange={(v) => cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, minutos: Math.round(Number(v) * 60) } : x)))}
                        />
                      </Table.Td>
                      <Table.Td>
                        <CloseButton aria-label="Quitar actividad" onClick={() => cambiarDia((d) => d.filter((_, j) => j !== i))} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="space-between" mt="sm">
                <Button variant="light" onClick={() => cambiarDia((d) => [...d, { actividadId: null, nombre: '', met: 1, minutos: 60 }])}>
                  Agregar actividad
                </Button>
                <Text size="sm" c={minutosDia > 1440 ? 'red' : 'dimmed'}>
                  {horas(minutosDia)} h asignadas ·{' '}
                  {minutosDia > 1440 ? `${horas(minutosDia - 1440)} h de más` : `${horas(1440 - minutosDia)} h en reposo (${b.metReposo.toLocaleString('es-CL')} MET)`}
                </Text>
              </Group>
              <Group mt="md" align="flex-end">
                <MultiSelect
                  label={`Copiar ${DIAS[dia].toLowerCase()} a`}
                  placeholder="Días"
                  data={DIAS.map((d, i) => ({ value: String(i), label: d })).filter((o) => o.value !== String(dia))}
                  value={destinos}
                  onChange={setDestinos}
                  w={360}
                />
                <Button variant="default" disabled={destinos.length === 0} onClick={copiarDia}>Copiar</Button>
              </Group>
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Gasto energético</Title>
            {calculo.error && <Alert color="red">{calculo.error}</Alert>}
            {r && (
              <Stack gap="sm">
                <Text>
                  TMB: <b>{kcal(r.tmb)}/día</b>
                  <Text span c="dimmed" size="sm"> · {FORMULAS.find((f) => f.id === r.formula.id)?.nombre ?? r.formula.id}</Text>
                </Text>
                <Table>
                  <Table.Tbody>
                    {DIAS.map((d, i) => (
                      <Table.Tr key={d} bg={i === dia ? 'var(--mantine-color-blue-light)' : undefined}>
                        <Table.Td>{d}</Table.Td>
                        <Table.Td ta="right">{kcal(r.porDia[i])}</Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr fw={700}>
                      <Table.Td>Promedio semanal</Table.Td>
                      <Table.Td ta="right">{kcal(r.promedio)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
                {r.avisos.map((a) => (
                  <Alert key={a} color="yellow">{a}</Alert>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
