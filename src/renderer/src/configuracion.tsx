// Pantalla de Configuración: valores de cálculo por defecto, respaldo, seguridad, tabla MET y pacientes de prueba.
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { FORMULAS } from '../../calculo/formulas'
import {
  configuracion,
  entradas,
  POBLACIONES_MET,
  type ActividadMet,
  type ActividadMetFormulario,
  type Configuracion
} from '../../shared/contratos'
import { llamar, useCambiosPendientes, validarCon } from './api'
import { decimal } from './formato'
import { fechaHora, RestaurarRespaldo } from './sesion'

const OPCIONES_FORMULA = FORMULAS.map((f) => ({ value: f.id, label: `${f.nombre} (${f.poblacion.descripcion})` }))
const NOMBRE_POBLACION: Record<string, string> = { adulto: 'Adultos', '60+': 'Adulto mayor (60+)' }
const OPCIONES_POBLACION = POBLACIONES_MET.map((p) => ({ value: p, label: NOMBRE_POBLACION[p] ?? `Juvenil ${p} años` }))

const Seccion = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <Paper withBorder p="md">
    <Title order={4} mb="sm">
      {titulo}
    </Title>
    <Stack>{children}</Stack>
  </Paper>
)

export function PantallaConfiguracion() {
  const config = useQuery({ queryKey: ['configuracion'], queryFn: () => llamar('configuracion.obtener', undefined) })
  if (!config.data) return config.error ? <Alert color="red">{config.error.message}</Alert> : <Loader />
  return (
    <Stack maw={1000}>
      <Title order={2}>Configuración</Title>
      <Tabs defaultValue="calculo" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="calculo">Cálculo</Tabs.Tab>
          <Tabs.Tab value="respaldo">Respaldo</Tabs.Tab>
          <Tabs.Tab value="seguridad">Seguridad</Tabs.Tab>
          <Tabs.Tab value="met">Tabla MET</Tabs.Tab>
          <Tabs.Tab value="prueba">Pacientes de prueba</Tabs.Tab>
        </Tabs.List>
        {/* Cálculo, respaldo y bloqueo son un solo formulario: guardar en cualquiera guarda todo. */}
        <FormularioConfiguracion inicial={config.data} />
        <Tabs.Panel value="met" pt="md">
          <TablaMet />
        </Tabs.Panel>
        <Tabs.Panel value="prueba" pt="md">
          <PacientesPrueba />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

function FormularioConfiguracion({ inicial }: { inicial: Configuracion }) {
  const qc = useQueryClient()
  const form = useForm<Configuracion>({ initialValues: inicial, validate: validarCon(configuracion) })
  useCambiosPendientes(form.isDirty())
  const guardar = useMutation({
    mutationFn: (c: Configuracion) => llamar('configuracion.guardar', c),
    onSuccess: (c) => {
      qc.setQueryData(['configuracion'], c)
      form.setInitialValues(c)
      form.reset()
      qc.invalidateQueries({ queryKey: ['respaldos'] })
    }
  })
  const elegir = useMutation({
    mutationFn: () => llamar('archivos.elegirCarpeta', { titulo: 'Carpeta para los respaldos' }),
    onSuccess: (c) => c && form.setFieldValue('carpetaRespaldo', c)
  })
  const botonGuardar = (
    <Group>
      <Button onClick={() => form.onSubmit((v) => guardar.mutate(v))()} loading={guardar.isPending} disabled={!form.isDirty()}>
        Guardar
      </Button>
      {guardar.isSuccess && !form.isDirty() && <Text size="sm" c="green">Guardado</Text>}
      {guardar.error && <Alert color="red">{guardar.error.message}</Alert>}
    </Group>
  )

  return (
    <>
      <Tabs.Panel value="calculo" pt="md">
        <Seccion titulo="Valores para el primer control de cada paciente">
          <Text size="sm" c="dimmed">
            Los controles siguientes copian los del control anterior. Cambiar esto no altera los controles ya guardados.
          </Text>
          <SimpleGrid cols={2}>
            <Select label="Fórmula de TMB desde los 19 años" data={OPCIONES_FORMULA} allowDeselect={false} {...form.getInputProps('formulaAdulto')} />
            <Select label="Fórmula de TMB en menores de 19 años" data={OPCIONES_FORMULA} allowDeselect={false} {...form.getInputProps('formulaMenor')} />
          </SimpleGrid>
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Modo MET
            </Text>
            <SegmentedControl
              data={[
                { value: 'estandar', label: 'MET × peso × horas' },
                { value: 'tmb', label: 'MET × TMB/24 × horas' }
              ]}
              {...form.getInputProps('modo')}
            />
            <Text size="xs" c="dimmed">
              En menores de 18 años siempre se usa MET × TMB/24, porque los METy del compendio juvenil son múltiplos de su TMB.
            </Text>
          </Stack>
          <SimpleGrid cols={2}>
            <NumberInput
              label="MET de reposo"
              description="Para las horas sin actividad (1,3 = sentado tranquilo)"
              decimalSeparator=","
              decimalScale={2}
              step={0.05}
              min={0.9}
              max={3}
              {...form.getInputProps('metReposo')}
            />
            <Switch mt="xl" label="Sumar ETA (10 %)" {...form.getInputProps('eta', { type: 'checkbox' })} />
          </SimpleGrid>
          {botonGuardar}
        </Seccion>
      </Tabs.Panel>

      <Tabs.Panel value="respaldo" pt="md">
        <Stack>
          <Seccion titulo="Respaldo automático">
            <Text size="sm">
              Al cerrar el sistema se copia la base (cifrada) y su archivo de claves a una carpeta nueva con la fecha, si hubo cambios desde el último
              respaldo. Se guardan las copias más recientes y las más antiguas se borran.
            </Text>
            <Group align="flex-end">
              <TextInput
                label="Carpeta de respaldos"
                value={form.values.carpetaRespaldo ?? 'Predeterminada: carpeta "respaldos" junto a los datos, en este mismo disco'}
                readOnly
                flex={1}
              />
              <Button variant="default" onClick={() => elegir.mutate()} loading={elegir.isPending}>
                Cambiar…
              </Button>
              {form.values.carpetaRespaldo !== null && (
                <Button variant="subtle" onClick={() => form.setFieldValue('carpetaRespaldo', null)}>
                  Usar la predeterminada
                </Button>
              )}
            </Group>
            {elegir.error && <Alert color="red">{elegir.error.message}</Alert>}
            {form.values.carpetaRespaldo === null && (
              <Alert color="yellow">
                Un respaldo en el mismo disco no sirve si el disco falla o se pierde el computador. Elija un pendrive, un disco externo o una carpeta que
                se sincronice con la nube (OneDrive, Google Drive): el respaldo va cifrado.
              </Alert>
            )}
            <NumberInput label="Copias que se guardan" min={1} max={100} allowDecimal={false} w={240} {...form.getInputProps('copiasRespaldo')} />
            {botonGuardar}
          </Seccion>
          <Respaldos />
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="seguridad" pt="md">
        <Seccion titulo="Bloqueo por inactividad">
          <NumberInput
            label="Minutos sin uso antes de bloquear"
            description="0 = no se bloquea solo. Lo que no se ha guardado sigue en pantalla al volver a abrir."
            min={0}
            max={240}
            allowDecimal={false}
            w={320}
            {...form.getInputProps('minutosBloqueo')}
          />
          {botonGuardar}
        </Seccion>
        <Seguridad />
      </Tabs.Panel>
    </>
  )
}

function Respaldos() {
  const qc = useQueryClient()
  const lista = useQuery({ queryKey: ['respaldos', null], queryFn: () => llamar('respaldo.listar', { carpeta: null }) })
  const crear = useMutation({
    mutationFn: () => llamar('respaldo.crear', undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['respaldos'] })
  })
  const ultimo = lista.data?.respaldos[0]
  return (
    <>
      <Seccion titulo="Respaldar ahora">
        <Group>
          <Button onClick={() => crear.mutate()} loading={crear.isPending}>
            Respaldar ahora
          </Button>
          <Text size="sm" c="dimmed">
            {ultimo ? `Último respaldo: ${fechaHora(ultimo.fecha)}` : 'Aún no hay respaldos en la carpeta configurada'}
          </Text>
        </Group>
        {crear.data && <Text size="sm" c="green">{crear.data.ruta ? `Respaldo creado en ${crear.data.ruta}` : 'No hubo cambios desde el último respaldo.'}</Text>}
        {crear.error && <Alert color="red">{crear.error.message}</Alert>}
      </Seccion>
      <Seccion titulo="Restaurar">
        <Text size="sm">
          Reemplaza los datos actuales por los de un respaldo. Antes se comprueba que el respaldo abre y no está dañado; los datos actuales quedan
          guardados aparte (.antes-de-restaurar.bak) por si hay que volver atrás.
        </Text>
        <RestaurarRespaldo conConfigurada />
      </Seccion>
    </>
  )
}

function Seguridad() {
  const qc = useQueryClient()
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined) })
  const form = useForm({
    initialValues: { actual: '', nueva: '', repetir: '' },
    validate: (v) => ({
      ...validarCon(entradas['sesion.cambiarContrasena'])(v),
      ...(v.nueva !== v.repetir ? { repetir: 'Las contraseñas no coinciden' } : {})
    })
  })
  const cambiar = useMutation({
    mutationFn: (v: typeof form.values) => llamar('sesion.cambiarContrasena', { actual: v.actual, nueva: v.nueva }),
    onSuccess: () => form.reset()
  })
  const olvidar = useMutation({
    mutationFn: () => llamar('sesion.olvidarEquipo', undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sesion'] })
  })
  return (
    <Stack mt="md">
      <Seccion titulo="Cambiar contraseña">
        <form onSubmit={form.onSubmit((v) => cambiar.mutate(v))}>
          <Stack maw={420}>
            <PasswordInput label="Contraseña actual" description="O la clave de recuperación impresa" {...form.getInputProps('actual')} />
            <PasswordInput label="Contraseña nueva" description="Mínimo 8 caracteres" {...form.getInputProps('nueva')} />
            <PasswordInput label="Repetir contraseña nueva" {...form.getInputProps('repetir')} />
            <Text size="xs" c="dimmed">
              La clave de recuperación no cambia. Los respaldos anteriores siguen abriendo con la contraseña que tenían.
            </Text>
            {cambiar.error && <Alert color="red">{cambiar.error.message}</Alert>}
            {cambiar.isSuccess && <Text size="sm" c="green">Contraseña cambiada</Text>}
            <Button type="submit" loading={cambiar.isPending} w="fit-content">
              Cambiar contraseña
            </Button>
          </Stack>
        </form>
      </Seccion>
      {sesion.data?.recordarDisponible && (
        <Seccion titulo="Recordar en este equipo">
          {sesion.data.recordada ? (
            <Group>
              <Text size="sm">El sistema abre sin contraseña al iniciar en esta cuenta de Windows.</Text>
              <Button variant="default" onClick={() => olvidar.mutate()} loading={olvidar.isPending}>
                Olvidar este equipo
              </Button>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              Desactivado. Se activa con la casilla "Recordar en este equipo" al abrir el sistema.
            </Text>
          )}
        </Seccion>
      )}
    </Stack>
  )
}

const VACIA: ActividadMetFormulario = { codigo: '', categoria: '', nombre: '', met: 1, poblacion: 'adulto' }

function TablaMet() {
  const qc = useQueryClient()
  const actividades = useQuery({ queryKey: ['met'], queryFn: () => llamar('catalogos.met', undefined), staleTime: Infinity })
  const [busqueda, setBusqueda] = useState('')
  const [poblacion, setPoblacion] = useState<string | null>(null)
  const [editando, setEditando] = useState<ActividadMetFormulario | null>(null)
  const texto = busqueda.trim().toLowerCase()
  const filtradas = (actividades.data ?? []).filter(
    (a) =>
      (!poblacion || a.poblacion === poblacion) &&
      (!texto || a.nombre.toLowerCase().includes(texto) || a.categoria.toLowerCase().includes(texto) || (a.codigo ?? '').includes(texto))
  )
  const MAXIMO = 100 // ponytail: corta la lista en vez de paginar; la búsqueda acota lo demás
  const editar = (a: ActividadMet) => setEditando({ id: a.id, codigo: a.codigo ?? '', categoria: a.categoria, nombre: a.nombre, met: a.met, poblacion: a.poblacion })

  return (
    <Stack mt="md">
      <Text size="sm" c="dimmed">
        Corregir o agregar actividades no cambia los controles ya guardados: cada rutina guarda el nombre y el MET que usó.
      </Text>
      <Group>
        <TextInput placeholder="Buscar por nombre, categoría o código" value={busqueda} onChange={(e) => setBusqueda(e.currentTarget.value)} w={340} />
        <Select placeholder="Todas las poblaciones" data={OPCIONES_POBLACION} value={poblacion} onChange={setPoblacion} clearable />
        <Button onClick={() => setEditando({ ...VACIA, poblacion: poblacion ?? 'adulto' })}>Agregar actividad</Button>
      </Group>
      {actividades.error && <Alert color="red">{actividades.error.message}</Alert>}
      <Text size="sm" c="dimmed">
        {filtradas.length} actividades{filtradas.length > MAXIMO ? `, se muestran las primeras ${MAXIMO}: busque para acotar` : ''}
      </Text>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Código</Table.Th>
            <Table.Th>Categoría</Table.Th>
            <Table.Th>Actividad</Table.Th>
            <Table.Th>Población</Table.Th>
            <Table.Th ta="right">MET</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtradas.slice(0, MAXIMO).map((a) => (
            <Table.Tr key={a.id} onClick={() => editar(a)} style={{ cursor: 'pointer' }}>
              <Table.Td>{a.codigo ?? '—'}</Table.Td>
              <Table.Td>{a.categoria}</Table.Td>
              <Table.Td>
                {a.nombre}
                {a.estimado && (
                  <Badge ml="xs" size="xs" variant="light" color="gray">
                    estimado
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>{OPCIONES_POBLACION.find((p) => p.value === a.poblacion)?.label ?? a.poblacion}</Table.Td>
              <Table.Td ta="right">{decimal(a.met)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={editando !== null} onClose={() => setEditando(null)} title={editando?.id ? 'Corregir actividad' : 'Agregar actividad'} size="lg">
        {editando && (
          <EditorActividad
            inicial={editando}
            alTerminar={() => {
              setEditando(null)
              qc.invalidateQueries({ queryKey: ['met'] })
            }}
          />
        )}
      </Modal>
    </Stack>
  )
}

function EditorActividad({ inicial, alTerminar }: { inicial: ActividadMetFormulario; alTerminar: () => void }) {
  const form = useForm({ initialValues: inicial, validate: validarCon(entradas['catalogos.guardarMet']) })
  const guardar = useMutation({ mutationFn: (a: ActividadMetFormulario) => llamar('catalogos.guardarMet', a), onSuccess: alTerminar })
  const eliminar = useMutation({ mutationFn: () => llamar('catalogos.eliminarMet', { id: inicial.id! }), onSuccess: alTerminar })
  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Stack>
        <SimpleGrid cols={2}>
          <TextInput label="Código" description="Opcional" {...form.getInputProps('codigo')} />
          <Select label="Población" data={OPCIONES_POBLACION} allowDeselect={false} {...form.getInputProps('poblacion')} />
        </SimpleGrid>
        <TextInput label="Categoría" {...form.getInputProps('categoria')} />
        <TextInput label="Actividad" {...form.getInputProps('nombre')} />
        <NumberInput label="MET" decimalSeparator="," decimalScale={2} step={0.1} min={0.5} max={25} w={160} {...form.getInputProps('met')} />
        {(guardar.error || eliminar.error) && <Alert color="red">{(guardar.error ?? eliminar.error)!.message}</Alert>}
        <Group justify="space-between">
          <Button type="submit" loading={guardar.isPending}>
            Guardar
          </Button>
          {inicial.id !== undefined && (
            <Anchor
              component="button"
              type="button"
              c="red"
              size="sm"
              onClick={() => window.confirm('¿Eliminar esta actividad de la tabla MET?') && eliminar.mutate()}
            >
              Eliminar
            </Anchor>
          )}
        </Group>
      </Stack>
    </form>
  )
}

function PacientesPrueba() {
  const qc = useQueryClient()
  const alTerminar = () => qc.invalidateQueries({ queryKey: ['pacientes'] })
  const crear = useMutation({ mutationFn: () => llamar('demo.crear', undefined), onSuccess: alTerminar })
  const eliminar = useMutation({ mutationFn: () => llamar('demo.eliminar', undefined), onSuccess: alTerminar })
  return (
    <Stack mt="md">
      <Seccion titulo="Pacientes de prueba">
        <Text size="sm">
          Cinco pacientes ficticios, uno por perfil (niño, adulta, adulto mayor, deportista y gestante), con tres controles cada uno: medidas,
          rutina, recordatorio de 24 horas y pauta. Sirven para revisar los cálculos y los informes. Su apellido termina en "(prueba)".
        </Text>
        <Group>
          <Button onClick={() => crear.mutate()} loading={crear.isPending}>
            Crear pacientes de prueba
          </Button>
          <Button
            variant="default"
            color="red"
            onClick={() => window.confirm('¿Eliminar todos los pacientes de prueba con sus controles?') && eliminar.mutate()}
            loading={eliminar.isPending}
          >
            Eliminar pacientes de prueba
          </Button>
        </Group>
        {crear.data && <Text size="sm" c="green">Se crearon {crear.data.pacientes} pacientes de prueba.</Text>}
        {eliminar.data && <Text size="sm" c="green">Se eliminaron {eliminar.data.pacientes} pacientes de prueba.</Text>}
        {(crear.error || eliminar.error) && <Alert color="red">{(crear.error ?? eliminar.error)!.message}</Alert>}
      </Seccion>
    </Stack>
  )
}
