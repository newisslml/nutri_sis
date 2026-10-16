import {
  Alert,
  Anchor,
  Badge,
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
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Timeline,
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
import {
  entradaGasto,
  type ActividadMet,
  type BloqueRutina,
  type Control,
  type ControlGuardar,
  type Examen,
  type Paciente
} from '../../shared/contratos'
import { edadEnMeses, formatearEdad } from '../../shared/validaciones'
import { llamar } from './api'

const kcal = (n: number) => `${n.toLocaleString('es-CL')} kcal`
/** 450 → "7 h 30 min", 45 → "45 min", 120 → "2 h" */
const duracion = (minutos: number) => {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 h'
}
const numero = (v: number | string) => (v === '' ? null : Number(v))
const fechaCL = (iso: string) => iso.split('-').reverse().join('-')
const decimal = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })
const imc = (pesoKg: number | null, tallaCm: number | null) => (pesoKg && tallaCm ? pesoKg / (tallaCm / 100) ** 2 : null)

const NOMBRE_ESTADO: Record<EstadoFisiologico, string> = {
  gestacion_t1: 'Gestación, 1.er trimestre',
  gestacion_t2: 'Gestación, 2.º trimestre',
  gestacion_t3: 'Gestación, 3.er trimestre',
  lactancia_0_6: 'Lactancia, 0 a 6 meses',
  lactancia_0_6_ganancia_insuficiente: 'Lactancia, 0 a 6 meses, ganancia gestacional insuficiente',
  lactancia_7_12: 'Lactancia, 7 a 12 meses'
}
const CAMPOS_HISTORIAL: [keyof Pick<Control, 'alergias' | 'intolerancias' | 'enfermedades' | 'medicamentos'>, string, string][] = [
  ['alergias', 'Alergias', 'Ej.: maní, mariscos, penicilina'],
  ['intolerancias', 'Intolerancias', 'Ej.: lactosa, fructosa'],
  ['enfermedades', 'Enfermedades de base', 'Ej.: diabetes tipo 2, hipertensión, hipotiroidismo'],
  ['medicamentos', 'Medicamentos y suplementos', 'Nombre, dosis y frecuencia. Ej.: metformina 850 mg c/12 h, vitamina D 2000 UI/día']
]
const OPCIONES_ESTADO =(Object.keys(ADICIONAL) as EstadoFisiologico[]).map((e) => ({
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
        <Button onClick={() => crear.mutate()} loading={crear.isPending}>
          Nuevo control
        </Button>
      </Group>
      {crear.error && <Alert color="red">{crear.error.message}</Alert>}
      {lista.data?.length === 0 && <Text c="dimmed">Sin controles todavía.</Text>}
      {!!lista.data?.length && (
        <Timeline active={lista.data.length - 1} bulletSize={14} lineWidth={2}>
          {lista.data.map((c, i) => {
            const previo = lista.data.slice(i + 1).find((x) => x.pesoKg !== null)
            const delta = c.pesoKg !== null && previo ? c.pesoKg - previo.pesoKg! : null
            const indice = imc(c.pesoKg, c.tallaCm)
            const datos = [
              c.edadMeses !== null && formatearEdad(c.edadMeses),
              c.pesoKg !== null &&
                `${decimal(c.pesoKg)} kg${delta === null ? '' : ` (${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${decimal(Math.abs(delta))})`}`,
              indice !== null && `IMC ${decimal(indice)}`,
              c.promedioKcal === null ? 'Gasto sin calcular' : `Gasto ${kcal(c.promedioKcal)}`
            ]
            return (
              <Timeline.Item
                key={c.id}
                title={
                  <Anchor component="button" fw={600} onClick={() => navegar(`/pacientes/${pacienteId}/controles/${c.id}`)}>
                    {fechaCL(c.fecha)}
                  </Anchor>
                }
              >
                <Text size="sm">{datos.filter(Boolean).join(' · ')}</Text>
                {c.motivo && (
                  <Text size="sm" c="dimmed">
                    {c.motivo}
                  </Text>
                )}
              </Timeline.Item>
            )
          })}
        </Timeline>
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

type Borrador = Omit<Control, 'gasto' | 'pacienteId' | 'edadMeses'>

function EditorControl({ inicial, paciente, actividades }: { inicial: Control; paciente: Paciente; actividades: ActividadMet[] }) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const [b, setB] = useState<Borrador>(() => {
    const { gasto: _g, pacienteId: _p, edadMeses: _e, ...resto } = inicial
    return resto
  })
  const [guardado, setGuardado] = useState(() => JSON.stringify(b))
  const [pestana, setPestana] = useState<string | null>('rutina')
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
  const meses = fechaValida ? edadEnMeses(paciente.fechaNacimiento, b.fecha) : null
  const edad = meses === null ? null : Math.floor(meses / 12)
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
  const descartar = useMutation({
    mutationFn: () => llamar('controles.descartar', { id: b.id }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['controles', paciente.id] })
      navegar(`/pacientes/${paciente.id}`)
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
  const cambiarExamen = (i: number, cambios: Partial<Examen>) =>
    setB((prev) => ({ ...prev, examenes: prev.examenes.map((x, j) => (j === i ? { ...x, ...cambios } : x)) }))

  const datosFormula = {
    pesoKg: b.pesoKg ?? 0,
    tallaCm: b.tallaCm ?? undefined,
    masaLibreGrasaKg: b.masaLibreGrasaKg ?? undefined,
    edad: edad ?? 0,
    sexo: paciente.sexo
  }
  const minutosDia = b.semana[dia].reduce((s, x) => s + x.minutos, 0)
  const indice = imc(b.pesoKg, b.tallaCm)
  // Sin cambios pendientes se muestra el resultado congelado al guardar; editando, el cálculo en vivo.
  const sinCambios = JSON.stringify(b) === guardado
  const congelado = sinCambios ? inicial.gasto : null
  const r = congelado ?? calculo.resultado

  function volver() {
    if (sinCambios || window.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')) navegar(`/pacientes/${paciente.id}`)
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Control del {fechaValida ? fechaCL(b.fecha) : '—'}</Title>
          <Text c="dimmed">
            {paciente.nombres} {paciente.apellidos} · {meses === null ? '—' : formatearEdad(meses)} al control ·{' '}
            {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
          </Text>
        </div>
        <Group>
          {!inicial.gasto && (
            <Button
              variant="subtle"
              color="red"
              loading={descartar.isPending}
              onClick={() => window.confirm('¿Descartar este control? Aún no tiene datos guardados.') && descartar.mutate()}
            >
              Descartar
            </Button>
          )}
          <Button variant="default" onClick={volver}>
            Volver a la ficha
          </Button>
          <Button onClick={() => guardar.mutate()} loading={guardar.isPending} disabled={!!congelado}>
            {congelado ? 'Guardado' : 'Guardar'}
          </Button>
        </Group>
      </Group>
      {(guardar.error ?? descartar.error) && <Alert color="red">{(guardar.error ?? descartar.error)!.message}</Alert>}

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack>
            <Paper withBorder p="md">
              <Group grow align="flex-start">
                <TextInput label="Fecha" type="date" value={b.fecha} onChange={(e) => cambiar({ fecha: e.currentTarget.value })} />
                <NumberInput
                  label="Peso (kg)"
                  decimalSeparator=","
                  decimalScale={1}
                  min={1}
                  max={400}
                  value={b.pesoKg ?? ''}
                  onChange={(v) => cambiar({ pesoKg: numero(v) })}
                />
                <NumberInput
                  label="Talla (cm)"
                  description={indice === null ? undefined : `IMC ${decimal(indice)} kg/m²`}
                  inputWrapperOrder={['label', 'input', 'description']}
                  decimalSeparator=","
                  decimalScale={1}
                  min={30}
                  max={250}
                  value={b.tallaCm ?? ''}
                  onChange={(v) => cambiar({ tallaCm: numero(v) })}
                />
                <NumberInput
                  label="Masa libre de grasa (kg)"
                  description={
                    b.masaLibreGrasaKg && b.pesoKg ? `${decimal((1 - b.masaLibreGrasaKg / b.pesoKg) * 100)} % de grasa` : 'Opcional: bioimpedancia o pliegues'
                  }
                  inputWrapperOrder={['label', 'input', 'description']}
                  decimalSeparator=","
                  decimalScale={1}
                  min={1}
                  max={200}
                  value={b.masaLibreGrasaKg ?? ''}
                  onChange={(v) => cambiar({ masaLibreGrasaKg: numero(v) })}
                />
              </Group>
            </Paper>

            <Tabs value={pestana} onChange={setPestana} variant="outline">
              <Tabs.List>
                <Tabs.Tab value="rutina">Rutina y gasto</Tabs.Tab>
                <Tabs.Tab value="notas">Motivo y notas</Tabs.Tab>
                <Tabs.Tab value="historial">Historial médico</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="historial" pt="md">
                <Stack>
                  <Paper withBorder p="md">
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      {CAMPOS_HISTORIAL.map(([campo, etiqueta, ejemplo]) => (
                        <Textarea
                          key={campo}
                          label={etiqueta}
                          placeholder={ejemplo}
                          autosize
                          minRows={3}
                          value={b[campo]}
                          onChange={(e) => cambiar({ [campo]: e.currentTarget.value })}
                        />
                      ))}
                    </SimpleGrid>
                  </Paper>
                  <Paper withBorder p="md">
                    <Title order={4} mb="sm">
                      Exámenes
                    </Title>
                    {b.examenes.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Sin exámenes registrados.
                      </Text>
                    ) : (
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={170}>Fecha</Table.Th>
                            <Table.Th>Examen y resultado</Table.Th>
                            <Table.Th w={40} />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {b.examenes.map((x, i) => (
                            <Table.Tr key={i}>
                              <Table.Td>
                                <TextInput type="date" value={x.fecha} onChange={(e) => cambiarExamen(i, { fecha: e.currentTarget.value })} />
                              </Table.Td>
                              <Table.Td>
                                <TextInput
                                  placeholder="Ej.: glicemia en ayunas 98 mg/dL"
                                  value={x.detalle}
                                  onChange={(e) => cambiarExamen(i, { detalle: e.currentTarget.value })}
                                />
                              </Table.Td>
                              <Table.Td>
                                <CloseButton aria-label="Quitar examen" onClick={() => cambiar({ examenes: b.examenes.filter((_, j) => j !== i) })} />
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                    <Button variant="light" mt="sm" onClick={() => cambiar({ examenes: [...b.examenes, { fecha: b.fecha, detalle: '' }] })}>
                      Agregar examen
                    </Button>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="notas" pt="md">
                <Paper withBorder p="md">
                  <Stack>
                    <TextInput label="Motivo de consulta" value={b.motivo} onChange={(e) => cambiar({ motivo: e.currentTarget.value })} />
                    <Textarea
                      label="Notas"
                      autosize
                      minRows={8}
                      value={b.notas}
                      onChange={(e) => cambiar({ notas: e.currentTarget.value })}
                    />
                  </Stack>
                </Paper>
              </Tabs.Panel>

              <Tabs.Panel value="rutina" pt="md">
                <Stack>
                  <Paper withBorder p="md">
                    <Group grow align="flex-start">
                      <Select
                        label="Fórmula de TMB"
                        allowDeselect={false}
                        data={FORMULAS.map((f) => {
                          const faltan = faltantes(f, datosFormula)
                          return { value: f.id, label: faltan.length ? `${f.nombre} (falta ${faltan.join(', ')})` : f.nombre, disabled: faltan.length > 0 }
                        })}
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
                      <NumberInput
                        label="TMB ajustada (kcal)"
                        description="Opcional: calorimetría o criterio clínico"
                        min={300}
                        max={6000}
                        value={b.tmbManual ?? ''}
                        onChange={(v) => cambiar({ tmbManual: numero(v) })}
                      />
                    </Group>
                    {paciente.sexo === 'F' && (
                      <Select
                        mt="md"
                        label="Gestación o lactancia"
                        placeholder="No aplica"
                        clearable
                        data={OPCIONES_ESTADO}
                        value={b.estado}
                        onChange={(v) => cambiar({ estado: v as EstadoFisiologico | null })}
                      />
                    )}
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
                    <Title order={4} mb="sm">
                      Rutina semanal
                    </Title>
                    <Tabs value={String(dia)} onChange={(v) => setDia(Number(v))}>
                      <Tabs.List>
                        {DIAS.map((d, i) => {
                          const total = b.semana[i].reduce((s, x) => s + x.minutos, 0)
                          return (
                            <Tabs.Tab key={d} value={String(i)} c={total > 1440 ? 'red' : undefined}>
                              {d.slice(0, 3)} · {duracion(total)}
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
                          <Table.Th w={90}>Horas</Table.Th>
                          <Table.Th w={90}>Minutos</Table.Th>
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
                                  if (a)
                                    cambiarDia((d) =>
                                      d.map((x, j) => (j === i ? { ...x, actividadId: a.id, nombre: a.nombre, met: a.met } : x))
                                    )
                                }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                decimalSeparator=","
                                decimalScale={2}
                                min={0.5}
                                max={25}
                                value={bloque.met}
                                onChange={(v) => cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, met: Number(v) } : x)))}
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                allowDecimal={false}
                                allowNegative={false}
                                max={24}
                                value={Math.floor(bloque.minutos / 60)}
                                onChange={(v) =>
                                  cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, minutos: Number(v) * 60 + (x.minutos % 60) } : x)))
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              {/* Más de 59 minutos pasan a horas: 90 queda en 1 h 30 min */}
                              <NumberInput
                                allowDecimal={false}
                                allowNegative={false}
                                step={5}
                                value={bloque.minutos % 60}
                                onChange={(v) =>
                                  cambiarDia((d) => d.map((x, j) => (j === i ? { ...x, minutos: Math.floor(x.minutos / 60) * 60 + Number(v) } : x)))
                                }
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
                      <Button
                        variant="light"
                        onClick={() => cambiarDia((d) => [...d, { actividadId: null, nombre: '', met: 1, minutos: 60 }])}
                      >
                        Agregar actividad
                      </Button>
                      <Text size="sm" c={minutosDia > 1440 ? 'red' : 'dimmed'}>
                        {duracion(minutosDia)} asignadas ·{' '}
                        {minutosDia > 1440
                          ? `${duracion(minutosDia - 1440)} de más`
                          : `${duracion(1440 - minutosDia)} en reposo (${b.metReposo.toLocaleString('es-CL')} MET)`}
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
                      <Button variant="default" disabled={destinos.length === 0} onClick={copiarDia}>
                        Copiar
                      </Button>
                    </Group>
                  </Paper>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Gasto energético</Title>
              {r && (
                <Badge color={congelado ? 'green' : 'yellow'} variant="light">
                  {congelado ? 'Guardado' : 'En vivo, sin guardar'}
                </Badge>
              )}
            </Group>
            {!congelado && calculo.error && <Alert color="red">{calculo.error}</Alert>}
            {r && (
              <Stack gap="sm">
                <Text>
                  TMB: <b>{kcal(r.tmb)}/día</b>
                  <Text span c="dimmed" size="sm">
                    {' '}
                    ·{' '}
                    {r.formula.id === 'manual'
                      ? 'ajustada a mano'
                      : `${FORMULAS.find((f) => f.id === r.formula.id)?.nombre ?? r.formula.id} v${r.formula.version}`}
                  </Text>
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
                  <Alert key={a} color="yellow">
                    {a}
                  </Alert>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
