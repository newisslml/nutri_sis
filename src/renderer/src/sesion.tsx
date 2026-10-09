import { Alert, Button, Center, Checkbox, Code, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { entradas } from '../../shared/contratos'
import { llamar, validarCon } from './api'

function Caja({ children }: { children: React.ReactNode }) {
  return (
    <Center h="100vh">
      <Paper withBorder shadow="sm" p="xl" w={460}>
        <Stack>{children}</Stack>
      </Paper>
    </Center>
  )
}

export function PrimeraVez() {
  const qc = useQueryClient()
  const [clave, setClave] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)
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
        </Stack>
      </form>
    </Caja>
  )
}

export function Desbloqueo() {
  const qc = useQueryClient()
  const form = useForm({ initialValues: { secreto: '' }, validate: validarCon(entradas['sesion.desbloquear']) })
  const desbloquear = useMutation({
    mutationFn: (v: typeof form.values) => llamar('sesion.desbloquear', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sesion'] })
  })

  return (
    <Caja>
      <form onSubmit={form.onSubmit((v) => desbloquear.mutate(v))}>
        <Stack>
          <Title order={3}>Sistema Nutri</Title>
          <PasswordInput
            label="Contraseña"
            description="O la clave de recuperación impresa"
            autoFocus
            {...form.getInputProps('secreto')}
          />
          {desbloquear.error && <Alert color="red">{desbloquear.error.message}</Alert>}
          <Button type="submit" loading={desbloquear.isPending}>Abrir</Button>
        </Stack>
      </form>
    </Caja>
  )
}
