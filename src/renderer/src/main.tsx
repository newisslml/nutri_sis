import '@mantine/core/styles.css'
import { AppShell, Button, Center, Group, Loader, MantineProvider, Title } from '@mantine/core'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { llamar } from './api'
import { PantallaControl } from './controles'
import { FichaPaciente, ListaPacientes } from './pacientes'
import { Desbloqueo, PrimeraVez } from './sesion'

function App() {
  const qc = useQueryClient()
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined) })

  if (!sesion.data) return <Center h="100vh"><Loader /></Center>
  if (!sesion.data.abierta) return sesion.data.configurada ? <Desbloqueo /> : <PrimeraVez />

  async function bloquear() {
    await llamar('sesion.bloquear', undefined)
    await qc.resetQueries() // borra datos de pacientes de la memoria y vuelve a preguntar la sesión
  }

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Sistema Nutri</Title>
          <Button variant="subtle" onClick={bloquear}>Bloquear</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Routes>
          <Route path="/pacientes" element={<ListaPacientes />} />
          <Route path="/pacientes/nuevo" element={<FichaPaciente />} />
          <Route path="/pacientes/:id" element={<FichaPaciente />} />
          <Route path="/pacientes/:id/controles/:controlId" element={<PantallaControl />} />
          <Route path="*" element={<Navigate to="/pacientes" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>
)
