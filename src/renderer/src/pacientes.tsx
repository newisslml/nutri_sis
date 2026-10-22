import {
  Alert,
  Button,
  Center,
  Checkbox,
  Fieldset,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Textarea,
  TextInput,
  Title,
  useComputedColorScheme
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  FRECUENCIAS,
  NOMBRE_FRECUENCIA,
  NOMBRE_PERFIL,
  NOMBRE_PREFERENCIA,
  NOMBRE_SINTOMA,
  PERFILES,
  PREFERENCIAS,
  SINTOMAS,
  pacienteEntrada,
  type Paciente,
  type PacienteFormulario,
  type Perfil
} from '../../shared/contratos'
import { edadEnAnios, hoyISO } from '../../shared/validaciones'
import { llamar, useCambiosPendientes, validarCon } from './api'
import { ListaControles } from './controles'
import { Grupo, UsuarioMas } from './iconos'

const OPCIONES_PERFIL = PERFILES.map((p) => ({ value: p, label: NOMBRE_PERFIL[p] }))
const OPCIONES_PREFERENCIA = PREFERENCIAS.map((p) => ({ value: p, label: NOMBRE_PREFERENCIA[p] }))
const OPCIONES_FRECUENCIA = FRECUENCIAS.map((f) => ({ value: f, label: NOMBRE_FRECUENCIA[f] }))
const OPCIONES_SEXO = [
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' }
]

// Violeta del diseño en Figma, oscurecido hacia abajo: el texto blanco contrasta entre 4,8:1 y 7,9:1 (WCAG AA).
const DEGRADADO = { from: '#6359FF', to: '#4338CA', deg: 135 }

export function Inicio() {
  const navegar = useNavigate()
  const oscuro = useComputedColorScheme('light') === 'dark'
  const boton = {
    className: 'icono-animado',
    variant: 'gradient',
    gradient: DEGRADADO,
    w: 360,
    h: 300,
    radius: 'md',
    fz: 26,
    styles: { label: { flexDirection: 'column', justifyContent: 'center', gap: 8 } } // ícono arriba del texto, centrados
  } as const
  return (
    <Center bg={oscuro ? 'dark.6' : '#D9D9D9'} mih="calc(100dvh - 56px - 2 * var(--mantine-spacing-md))" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
      <Group gap={64}>
        <Button {...boton} onClick={() => navegar('/pacientes/nuevo')}>
          <UsuarioMas size={200} />
          Paciente nuevo
        </Button>
        <Button {...boton} onClick={() => navegar('/pacientes')}>
          <Grupo size={200} />
          Paciente existente
        </Button>
      </Group>
    </Center>
  )
}

export function ListaPacientes() {
  const navegar = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const lista = useQuery({
    queryKey: ['pacientes', busqueda, perfil],
    queryFn: () => llamar('pacientes.listar', { busqueda, perfil })
  })

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Pacientes</Title>
        <Button onClick={() => navegar('/pacientes/nuevo')}>Nuevo paciente</Button>
      </Group>
      <Group>
        <TextInput placeholder="Buscar por nombre o RUT" value={busqueda} onChange={(e) => setBusqueda(e.currentTarget.value)} w={320} />
        <Select placeholder="Todos los perfiles" data={OPCIONES_PERFIL} value={perfil} onChange={(v) => setPerfil(v as Perfil | null)} clearable />
      </Group>
      {lista.error && <Alert color="red">{lista.error.message}</Alert>}
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>RUT</Table.Th>
            <Table.Th>Edad</Table.Th>
            <Table.Th>Sexo</Table.Th>
            <Table.Th>Perfil</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lista.data?.map((p) => (
            <Table.Tr key={p.id} onClick={() => navegar(`/pacientes/${p.id}`)} style={{ cursor: 'pointer' }}>
              <Table.Td>{p.nombre}</Table.Td>
              <Table.Td>{p.rut ?? '—'}</Table.Td>
              <Table.Td>{edadEnAnios(p.fechaNacimiento, hoyISO())} años</Table.Td>
              <Table.Td>{p.sexo}</Table.Td>
              <Table.Td>{NOMBRE_PERFIL[p.perfil]}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {lista.data?.length === 0 && <Alert>No hay pacientes que coincidan.</Alert>}
    </Stack>
  )
}

export function FichaPaciente() {
  const { id } = useParams()
  const paciente = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => llamar('pacientes.obtener', { id: Number(id) }),
    enabled: id !== undefined
  })
  if (id !== undefined && !paciente.data) return paciente.error ? <Alert color="red">{paciente.error.message}</Alert> : <Loader />
  return (
    <Stack gap="xl">
      <FormularioPaciente inicial={paciente.data} />
      {paciente.data && <ListaControles pacienteId={paciente.data.id} />}
    </Stack>
  )
}

type Valores = Omit<PacienteFormulario, 'sexo' | 'perfil' | 'preferencia' | 'sintomas' | 'tabaco' | 'alcohol'> & {
  sexo: string | null
  perfil: string | null
  preferencia: string | null
  sintomas: string[]
  tabaco: string | null
  alcohol: string | null
}

const VACIO: Valores = {
  rut: '',
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: null,
  perfil: null,
  disciplina: '',
  direccion: '',
  telefono: '',
  correo: '',
  preferencia: null,
  sintomas: [],
  tabaco: '',
  alcohol: '',
  objetivo: '',
  consentimiento: false,
  tutorNombre: ''
}

function FormularioPaciente({ inicial }: { inicial?: Paciente }) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const form = useForm<Valores>({
    initialValues: inicial ? { ...inicial, rut: inicial.rut ?? '' } : VACIO,
    validate: validarCon(pacienteEntrada)
  })
  useCambiosPendientes(form.isDirty())
  const guardar = useMutation({
    mutationFn: (v: Valores) => llamar('pacientes.guardar', v as PacienteFormulario),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pacientes'] })
      await qc.invalidateQueries({ queryKey: ['paciente'] })
      navegar('/pacientes')
    }
  })
  const f = form.values.fechaNacimiento
  const menor = /^\d{4}-\d{2}-\d{2}$/.test(f) && edadEnAnios(f, hoyISO()) < 18

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Stack maw={900}>
        <Title order={2}>{inicial ? `${inicial.nombres} ${inicial.apellidos}` : 'Nuevo paciente'}</Title>
        <SimpleGrid cols={2}>
          <TextInput label="Nombres" withAsterisk {...form.getInputProps('nombres')} />
          <TextInput label="Apellidos" withAsterisk {...form.getInputProps('apellidos')} />
          <TextInput label="RUT" placeholder="12.345.678-5" {...form.getInputProps('rut')} />
          <TextInput label="Fecha de nacimiento" type="date" withAsterisk {...form.getInputProps('fechaNacimiento')} />
          <Select label="Sexo biológico" description="Lo usan las fórmulas y ecuaciones" data={OPCIONES_SEXO} withAsterisk {...form.getInputProps('sexo')} />
          <Select label="Perfil" data={OPCIONES_PERFIL} withAsterisk {...form.getInputProps('perfil')} />
          <TextInput label="Disciplina deportiva" {...form.getInputProps('disciplina')} />
          <Select label="Preferencia alimentaria" data={OPCIONES_PREFERENCIA} clearable {...form.getInputProps('preferencia')} />
          {menor && <TextInput label="Tutor que consiente" withAsterisk {...form.getInputProps('tutorNombre')} />}
        </SimpleGrid>
        <Fieldset legend="Contacto">
          <SimpleGrid cols={3}>
            <TextInput label="Dirección de domicilio" {...form.getInputProps('direccion')} />
            <TextInput label="Teléfono" placeholder="+56 9 1234 5678" {...form.getInputProps('telefono')} />
            <TextInput label="Correo" type="email" placeholder="nombre@correo.cl" {...form.getInputProps('correo')} />
          </SimpleGrid>
        </Fieldset>
        <Fieldset legend="Anamnesis próxima">
          <Stack>
            <Checkbox.Group label="Síntomas presentes" {...form.getInputProps('sintomas')}>
              <Group mt="xs">
                {SINTOMAS.map((s) => (
                  <Checkbox key={s} value={s} label={NOMBRE_SINTOMA[s]} />
                ))}
              </Group>
            </Checkbox.Group>
            <SimpleGrid cols={2}>
              {(['tabaco', 'alcohol'] as const).map((campo) => (
                <Stack key={campo} gap="xs">
                  <Switch
                    label={`Consume ${campo}`}
                    checked={form.values[campo] !== ''}
                    onChange={(e) => form.setFieldValue(campo, e.currentTarget.checked ? null : '')}
                  />
                  {form.values[campo] !== '' && <Select placeholder="¿Con qué frecuencia?" data={OPCIONES_FRECUENCIA} {...form.getInputProps(campo)} />}
                </Stack>
              ))}
            </SimpleGrid>
          </Stack>
        </Fieldset>
        <Textarea label="Objetivo" autosize minRows={2} {...form.getInputProps('objetivo')} />
        <Checkbox
          label={`${menor ? 'El tutor' : 'El paciente'} dio consentimiento expreso para el tratamiento de sus datos de salud`}
          disabled={!!inicial}
          {...form.getInputProps('consentimiento', { type: 'checkbox' })}
        />
        {guardar.error && <Alert color="red">{guardar.error.message}</Alert>}
        <Group>
          <Button type="submit" loading={guardar.isPending}>Guardar</Button>
          <Button variant="default" onClick={() => navegar('/pacientes')}>Cancelar</Button>
        </Group>
      </Stack>
    </form>
  )
}
