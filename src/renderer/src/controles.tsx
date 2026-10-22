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
import {
  GRUPOS,
  PLIEGUES_4,
  PLIEGUES_6,
  PLIEGUES_8,
  durninWomersley,
  kerr,
  sumaPliegues,
  type DatosAntropometria,
  type Grupo,
  type Sitio
} from '../../calculo/antropometria'
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
import { edadEnAnios, edadEnMeses, formatearEdad } from '../../shared/validaciones'
import { llamar, useCambiosPendientes } from './api'
import { decimal, fechaCL, kilos } from './formato'
import { InformeBicompartimental, InformePentacompartimental, type PuntoEvolucion } from './informes'

const kcal = (n: number) => `${n.toLocaleString('es-CL')} kcal`
/** 450 → "7 h 30 min", 45 → "45 min", 120 → "2 h" */
const duracion = (minutos: number) => {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 h'
}
const numero = (v: number | string) => (v === '' ? null : Number(v))
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
const SUMAS_PLIEGUES: [string, Sitio<'pliegues'>[]][] = [
  ['Σ 4 pliegues (Durnin)', PLIEGUES_4],
  ['Σ 6 pliegues (Kerr)', PLIEGUES_6],
  ['Σ 8 pliegues', PLIEGUES_8]
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
    if (!b.pesoKg) return { error: 'Ingrese el peso en la pestaña Antropometría para calcular el gasto' }
    if (!fechaValida) return { error: 'Ingrese la fecha del control en la pestaña Antropometría' }
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
      qc.invalidateQueries({ queryKey: ['evolucion', r.pacienteId] })
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
  // Borrar un valor lo deja en undefined (no se guarda) sin mover la clave, para que "sin cambios" siga comparando igual.
  const cambiarMedida = (g: Grupo, sitio: string, v: number | string) =>
    setB((prev) => ({
      ...prev,
      antropometria: { ...prev.antropometria, [g]: { ...prev.antropometria[g], [sitio]: numero(v) ?? undefined } }
    }))

  const datosFormula = {
    pesoKg: b.pesoKg ?? 0,
    tallaCm: b.tallaCm ?? undefined,
    masaLibreGrasaKg: b.masaLibreGrasaKg ?? undefined,
    edad: edad ?? 0,
    sexo: paciente.sexo
  }
  const minutosDia = b.semana[dia].reduce((s, x) => s + x.minutos, 0)
  const indice = imc(b.pesoKg, b.tallaCm)
  const datosAntropometria: DatosAntropometria | null =
    b.pesoKg && b.tallaCm && edad !== null ? { pesoKg: b.pesoKg, tallaCm: b.tallaCm, edad, sexo: paciente.sexo, medidas: b.antropometria } : null
  // ponytail: composición en vivo desde las medidas, no se congela al guardar; congelar con id y versión como el gasto cuando se fijen las ecuaciones.
  const composicion = datosAntropometria && { kerr: kerr(datosAntropometria), durnin: durninWomersley(datosAntropometria) }
  const historial = useQuery({ queryKey: ['evolucion', paciente.id], queryFn: () => llamar('controles.evolucion', { pacienteId: paciente.id }) })
  // El control abierto entra con lo que se está editando; los demás, como quedaron guardados.
  const evolucion = useMemo<PuntoEvolucion[]>(() => {
    const guardados = (historial.data ?? []).filter((c) => c.id !== b.id).map((c) => ({ ...c, medidas: c.antropometria }))
    const abierto = fechaValida ? [{ fecha: b.fecha, pesoKg: b.pesoKg, tallaCm: b.tallaCm, medidas: b.antropometria }] : []
    return [...guardados, ...abierto]
      .sort((x, y) => x.fecha.localeCompare(y.fecha))
      .flatMap((c) =>
        c.pesoKg && c.tallaCm
          ? [{ fecha: c.fecha, datos: { pesoKg: c.pesoKg, tallaCm: c.tallaCm, edad: edadEnAnios(paciente.fechaNacimiento, c.fecha), sexo: paciente.sexo, medidas: c.medidas } }]
          : []
      )
  }, [historial.data, b.id, b.fecha, b.pesoKg, b.tallaCm, b.antropometria, fechaValida, paciente])
  const informe = { datos: datosAntropometria, paciente, fecha: b.fecha, edadMeses: meses, enfermedades: b.enfermedades, evolucion }
  const enInforme = pestana === 'penta' || pestana === 'bi'
  // Sin cambios pendientes se muestra el resultado congelado al guardar; editando, el cálculo en vivo.
  const sinCambios = JSON.stringify(b) === guardado
  useCambiosPendientes(!sinCambios)
  const congelado = sinCambios ? inicial.gasto : null
  const r = congelado ?? calculo.resultado
  const signo = { deficit: -1, normo: 0, superavit: 1 }[b.objetivoCalorico]
  const meta = r ? Math.round(r.promedio * (1 + (signo * b.ajustePct) / 100)) : 0

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
        <Grid.Col span={{ base: 12, lg: enInforme ? 12 : 8 }}>
          <Stack>
            <Tabs value={pestana} onChange={setPestana} variant="outline">
              <Tabs.List>
                <Tabs.Tab value="rutina">Rutina y gasto</Tabs.Tab>
                <Tabs.Tab value="antropometria">Antropometría</Tabs.Tab>
                <Tabs.Tab value="penta">Pentacompartimental</Tabs.Tab>
                <Tabs.Tab value="bi">Bicompartimental</Tabs.Tab>
                <Tabs.Tab value="notas">Motivo y notas</Tabs.Tab>
                <Tabs.Tab value="historial">Historial médico</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="antropometria" pt="md">
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
                          b.masaLibreGrasaKg && b.pesoKg
                            ? `${decimal((1 - b.masaLibreGrasaKg / b.pesoKg) * 100)} % de grasa`
                            : 'Opcional: bioimpedancia o pliegues'
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
                  {(Object.keys(GRUPOS) as Grupo[]).map((g) => (
                    <Paper withBorder p="md" key={g}>
                      <Title order={4} mb="sm">
                        {GRUPOS[g].titulo} ({GRUPOS[g].unidad})
                      </Title>
                      <SimpleGrid cols={{ base: 2, md: 4 }}>
                        {Object.entries(GRUPOS[g].sitios).map(([sitio, nombre]) => (
                          <NumberInput
                            key={sitio}
                            label={nombre}
                            decimalSeparator=","
                            decimalScale={1}
                            allowNegative={false}
                            max={GRUPOS[g].max}
                            value={(b.antropometria[g] as Record<string, number | undefined>)[sitio] ?? ''}
                            onChange={(v) => cambiarMedida(g, sitio, v)}
                          />
                        ))}
                      </SimpleGrid>
                      {g === 'pliegues' && (
                        <Group mt="md" gap="xl">
                          {SUMAS_PLIEGUES.map(([nombre, sitios]) => {
                            const suma = sumaPliegues(b.antropometria, sitios)
                            return (
                              <Text key={nombre} size="sm">
                                {nombre}:{' '}
                                {'mm' in suma ? (
                                  <b>{decimal(suma.mm)} mm</b>
                                ) : (
                                  <Text span c="dimmed" size="sm">
                                    {suma.faltan.length === 1 ? 'falta 1' : `faltan ${suma.faltan.length}`}
                                  </Text>
                                )}
                              </Text>
                            )
                          })}
                        </Group>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="penta" pt="md">
                <InformePentacompartimental {...informe} />
              </Tabs.Panel>

              <Tabs.Panel value="bi" pt="md">
                <InformeBicompartimental {...informe} />
              </Tabs.Panel>

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

        <Grid.Col span={{ base: 12, lg: 4 }} display={enInforme ? 'none' : undefined}>
          {pestana === 'antropometria' && (
            <Paper withBorder p="md" mb="md">
              <Title order={4} mb="sm">
                Composición corporal
              </Title>
              {!composicion ? (
                <Text size="sm" c="dimmed">
                  Ingrese fecha, peso y talla para calcular
                </Text>
              ) : (
                <Stack gap="sm">
                  <Text fw={600}>Kerr (5 componentes)</Text>
                  {'faltan' in composicion.kerr ? (
                    <Text size="sm" c="dimmed">
                      Falta: {composicion.kerr.faltan.join(', ')}
                    </Text>
                  ) : (
                    <>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Masa</Table.Th>
                            <Table.Th ta="right">kg</Table.Th>
                            <Table.Th ta="right">%</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(
                            [
                              ['Adiposa', composicion.kerr.resultado.adiposa],
                              ['Muscular', composicion.kerr.resultado.muscular],
                              ['Ósea', composicion.kerr.resultado.osea],
                              ['Residual', composicion.kerr.resultado.residual],
                              ['Piel', composicion.kerr.resultado.piel]
                            ] as const
                          ).map(([nombre, c]) => (
                            <Table.Tr key={nombre}>
                              <Table.Td>{nombre}</Table.Td>
                              <Table.Td ta="right">{kilos(c.kg)}</Table.Td>
                              <Table.Td ta="right">{decimal(c.pct)} %</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                      <Text size="sm" c="dimmed">
                        Masa libre de grasa {kilos(composicion.kerr.resultado.masaLibreGrasaKg)} kg · suma de masas sin ajustar{' '}
                        {kilos(composicion.kerr.resultado.pesoEstructuradoKg)} kg (
                        {decimal((composicion.kerr.resultado.pesoEstructuradoKg / b.pesoKg! - 1) * 100)} % respecto al peso)
                      </Text>
                    </>
                  )}
                  <Text fw={600}>Durnin-Womersley + Siri</Text>
                  {'faltan' in composicion.durnin ? (
                    <Text size="sm" c="dimmed">
                      Falta: {composicion.durnin.faltan.join(', ')}
                    </Text>
                  ) : (
                    <>
                      <Text>
                        Grasa: <b>{decimal(composicion.durnin.resultado.grasaPct)} %</b> ({kilos(composicion.durnin.resultado.grasaKg)} kg)
                        <Text span c="dimmed" size="sm">
                          {' '}
                          · masa libre de grasa {kilos(composicion.durnin.resultado.masaLibreGrasaKg)} kg
                        </Text>
                      </Text>
                      {composicion.durnin.resultado.avisos.map((a) => (
                        <Alert key={a} color="yellow">
                          {a}
                        </Alert>
                      ))}
                    </>
                  )}
                </Stack>
              )}
            </Paper>
          )}
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
                      <Table.Tr key={d} bg={i === dia ? 'var(--mantine-primary-color-light)' : undefined}>
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
          <Paper withBorder p="md" mt="md">
            <Title order={4} mb="sm">
              Objetivo calórico
            </Title>
            <SegmentedControl
              fullWidth
              data={[
                { value: 'deficit', label: 'Déficit' },
                { value: 'normo', label: 'Normocalórico' },
                { value: 'superavit', label: 'Superávit' }
              ]}
              value={b.objetivoCalorico}
              onChange={(v) => cambiar({ objetivoCalorico: v as Borrador['objetivoCalorico'], ajustePct: v === 'normo' ? 0 : b.ajustePct })}
            />
            <NumberInput
              mt="sm"
              label="Porcentaje respecto al GET"
              suffix=" %"
              allowDecimal={false}
              allowNegative={false}
              max={50}
              disabled={b.objetivoCalorico === 'normo'}
              value={b.ajustePct}
              onChange={(v) => cambiar({ ajustePct: Number(v) })}
            />
            {r && (
              <Stack gap="sm" mt="md">
                <Text>
                  Meta: <b>{kcal(meta)}/día</b>
                  <Text span c="dimmed" size="sm">
                    {' '}
                    ·{' '}
                    {signo === 0
                      ? 'igual al GET'
                      : `GET ${signo < 0 ? '−' : '+'} ${b.ajustePct} % (${kcal(Math.abs(meta - r.promedio))})`}
                  </Text>
                </Text>
                {meta < r.tmb && <Alert color="yellow">La meta queda bajo la TMB ({kcal(r.tmb)})</Alert>}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
