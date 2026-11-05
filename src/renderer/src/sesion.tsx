import { Alert, Anchor, Button, Center, Checkbox, Code, Group, Paper, PasswordInput, Radio, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { entradas } from '../../shared/contratos'
import { llamar, validarCon } from './api'
import { fechaCL } from './formato'

function Caja({ children, ancho = 460 }: { children: React.ReactNode; ancho?: number }) {
  return (
    <Center mih="100vh" py="xl">
      <Paper withBorder shadow="sm" p="xl" w={ancho}>
        <Stack>{children}</Stack>
      </Paper>
    </Center>
  )
}

export function PrimeraVez() {
  const qc = useQueryClient()
  const [clave, setClave] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const form = useForm({
    initialValues: { nombreProfesional: '', contrasena: '', repetir: '' },
    validate: (v) => ({
      ...validarCon(entradas['sesion.configurar'])(v),
      ...(v.contrasena !== v.repetir ? { repetir: 'Las contraseñas no coinciden' } : {})
    })
  })
  const configurar = useMutation({
    mutationFn: (v: typeof form.values) => llamar('sesion.configurar', v),
    onSuccess: (r) => setClave(r.claveRecuperacion)
  })

  if (restaurando)
    return (
      <Caja ancho={640}>
        <Title order={3}>Restaurar un respaldo</Title>
        <RestaurarRespaldo />
        <Anchor component="button" onClick={() => setRestaurando(false)}>
          Volver
        </Anchor>
      </Caja>
    )

  if (clave)
    return (
      <Caja>
        <Title order={3}>Clave de recuperación</Title>
        <Text>
          Imprímala y guárdela en un lugar seguro. Es la única forma de abrir los datos si olvida la contraseña. No se
          vuelve a mostrar.
        </Text>
        <Code block fz="xl" ta="center">{clave}</Code>
        <Button variant="light" onClick={() => window.print()}>Imprimir</Button>
        <Checkbox label="Ya la imprimí o anoté" checked={guardada} onChange={(e) => setGuardada(e.currentTarget.checked)} />
        <Button disabled={!guardada} onClick={() => qc.invalidateQueries({ queryKey: ['sesion'] })}>Continuar</Button>
      </Caja>
    )

  return (
    <Caja>
      <form onSubmit={form.onSubmit((v) => configurar.mutate(v))}>
        <Stack>
          <Title order={3}>Configuración inicial</Title>
          <Text size="sm" c="dimmed">Los datos se guardan cifrados en este equipo.</Text>
          <TextInput label="Nombre del profesional" {...form.getInputProps('nombreProfesional')} />
          <PasswordInput label="Contraseña" description="Mínimo 8 caracteres" {...form.getInputProps('contrasena')} />
          <PasswordInput label="Repetir contraseña" {...form.getInputProps('repetir')} />
          {configurar.error && <Alert color="red">{configurar.error.message}</Alert>}
          <Button type="submit" loading={configurar.isPending}>Crear base de datos</Button>
          <Anchor component="button" type="button" size="sm" onClick={() => setRestaurando(true)}>
            ¿Viene de otro equipo? Restaurar un respaldo
          </Anchor>
        </Stack>
      </form>
    </Caja>
  )
}

/**
 * Pantalla de bloqueo. Con alAbrir es el bloqueo por inactividad: se dibuja encima de la pantalla abierta, que sigue montada
 * (oculta) para no perder lo que no se ha guardado; ahí no se ofrece recordar ni restaurar.
 */
export function Desbloqueo({ alAbrir }: { alAbrir?: () => void }) {
  const qc = useQueryClient()
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined), enabled: false })
  const [restaurando, setRestaurando] = useState(false)
  const form = useForm({
    initialValues: { secreto: '', recordar: sesion.data?.recordada ?? false },
    validate: validarCon(entradas['sesion.desbloquear'])
  })
  const ofrecerRecordar = !alAbrir && sesion.data?.recordarDisponible
  const desbloquear = useMutation({
    mutationFn: (v: typeof form.values) => llamar('sesion.desbloquear', { secreto: v.secreto, recordar: ofrecerRecordar ? v.recordar : undefined }),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['sesion'] })
      alAbrir?.()
    }
  })

  if (restaurando)
    return (
      <Caja ancho={640}>
        <Title order={3}>Restaurar un respaldo</Title>
        <Text size="sm">Los datos actuales de este equipo se reemplazan por los del respaldo (quedan guardados aparte, por si acaso).</Text>
        <RestaurarRespaldo />
        <Anchor component="button" onClick={() => setRestaurando(false)}>
          Volver
        </Anchor>
      </Caja>
    )

  return (
    <Caja>
      <form onSubmit={form.onSubmit((v) => desbloquear.mutate(v))}>
        <Stack>
          <Title order={3}>Sistema Nutri</Title>
          {alAbrir && <Text size="sm" c="dimmed">Se bloqueó por inactividad. Lo que no había guardado sigue en pantalla.</Text>}
          <PasswordInput
            label="Contraseña"
            description="O la clave de recuperación impresa"
            autoFocus
            {...form.getInputProps('secreto')}
          />
          {ofrecerRecordar && (
            <Checkbox
              label="Recordar en este equipo"
              description="Abre sin contraseña al iniciar, solo con esta cuenta de Windows. Al bloquearse se vuelve a pedir."
              {...form.getInputProps('recordar', { type: 'checkbox' })}
            />
          )}
          {desbloquear.error && <Alert color="red">{desbloquear.error.message}</Alert>}
          <Button type="submit" loading={desbloquear.isPending}>Abrir</Button>
          {!alAbrir && (
            <Anchor component="button" type="button" size="sm" onClick={() => setRestaurando(true)}>
              Restaurar un respaldo
            </Anchor>
          )}
        </Stack>
      </form>
    </Caja>
  )
}

const megas = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`
export const fechaHora = (iso: string) => `${fechaCL(iso.slice(0, 10))} ${iso.slice(11, 16)}`

/**
 * Elegir un respaldo y restaurarlo. conConfigurada: parte listando la carpeta de respaldos de Configuración (base abierta);
 * si no, primero se elige la carpeta. Pide la contraseña que tenía el sistema al respaldar, o la clave de recuperación.
 */
export function RestaurarRespaldo({ conConfigurada = false }: { conConfigurada?: boolean }) {
  const qc = useQueryClient()
  const [carpeta, setCarpeta] = useState<string | null>(null) // null: la configurada
  const [elegido, setElegido] = useState<string | null>(null)
  const [secreto, setSecreto] = useState('')
  const lista = useQuery({
    queryKey: ['respaldos', carpeta],
    queryFn: () => llamar('respaldo.listar', { carpeta }),
    enabled: conConfigurada || carpeta !== null
  })
  const elegir = useMutation({
    mutationFn: () => llamar('archivos.elegirCarpeta', { titulo: 'Carpeta con los respaldos (o un respaldo)' }),
    onSuccess: (c) => {
      if (!c) return
      setCarpeta(c)
      setElegido(null)
    }
  })
  const restaurar = useMutation({
    mutationFn: () => llamar('respaldo.restaurar', { carpeta: elegido!, secreto }),
    onSuccess: () => qc.resetQueries() // todo se vuelve a leer de la base restaurada
  })
  const confirmar = () =>
    window.confirm('Los datos actuales se reemplazarán por los del respaldo elegido (los actuales quedan como .antes-de-restaurar.bak). ¿Continuar?') &&
    restaurar.mutate()

  return (
    <Stack>
      <Group>
        <Button variant="default" onClick={() => elegir.mutate()} loading={elegir.isPending}>
          {conConfigurada ? 'Buscar en otra carpeta…' : 'Elegir carpeta…'}
        </Button>
        {lista.data && (
          <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
            {lista.data.carpeta}
          </Text>
        )}
      </Group>
      {elegir.error && <Alert color="red">{elegir.error.message}</Alert>}
      {lista.error && <Alert color="red">{lista.error.message}</Alert>}
      {lista.data && lista.data.respaldos.length === 0 && <Text size="sm">No hay respaldos en esta carpeta.</Text>}
      {lista.data && lista.data.respaldos.length > 0 && (
        <Radio.Group value={elegido} onChange={setElegido}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                <Table.Th>Fecha</Table.Th>
                <Table.Th ta="right">Tamaño</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lista.data.respaldos.map((r) => (
                <Table.Tr key={r.carpeta} onClick={() => setElegido(r.carpeta)} style={{ cursor: 'pointer' }}>
                  <Table.Td>
                    <Radio value={r.carpeta} aria-label={fechaHora(r.fecha)} />
                  </Table.Td>
                  <Table.Td>{fechaHora(r.fecha)}</Table.Td>
                  <Table.Td ta="right">{megas(r.bytes)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Radio.Group>
      )}
      {elegido && (
        <>
          <PasswordInput
            label="Contraseña del respaldo"
            description="La que tenía el sistema cuando se hizo el respaldo, o la clave de recuperación impresa"
            value={secreto}
            onChange={(e) => setSecreto(e.currentTarget.value)}
          />
          {restaurar.error && <Alert color="red">{restaurar.error.message}</Alert>}
          <Button color="red" disabled={!secreto} loading={restaurar.isPending} onClick={confirmar}>
            Restaurar este respaldo
          </Button>
        </>
      )}
    </Stack>
  )
}
