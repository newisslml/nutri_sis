import '@mantine/core/styles.css'
import {
  ActionIcon,
  Anchor,
  AppShell,
  Center,
  createTheme,
  Group,
  Loader,
  MantineProvider,
  SegmentedControl,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme
} from '@mantine/core'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { confirmarSalida, llamar } from './api'
import { PantallaControl } from './controles'
import { Brillo, Candado, Casa, Luna } from './iconos'
import { FichaPaciente, Inicio, ListaPacientes } from './pacientes'
import { Desbloqueo, PrimeraVez } from './sesion'

// Violeta del diseño en Figma (#6359FF, tono 5) como color principal de botones, switches, casillas y pestañas.
// El tono 6, el que usa Mantine, es apenas más oscuro para que el texto contraste ≥ 4,5:1 (WCAG AA) en blanco sobre
// violeta y en violeta sobre su fondo claro (variante "light").
const tema = createTheme({
  primaryColor: 'violeta',
  colors: {
    violeta: ['#EFEEFF', '#DDDBFF', '#B9B4FF', '#938CFF', '#766DFB', '#6359FF', '#564CF2', '#4A40DD', '#4338CA', '#362DA6']
  },
  components: { SegmentedControl: SegmentedControl.extend({ defaultProps: { color: 'violeta' } }) }
})

function App() {
  const qc = useQueryClient()
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined) })
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const { toggleColorScheme } = useMantineColorScheme()
  const oscuro = useComputedColorScheme('light') === 'dark' // Mantine lo recuerda en localStorage

  if (!sesion.data) return <Center h="100vh"><Loader /></Center>
  if (!sesion.data.abierta) return sesion.data.configurada ? <Desbloqueo /> : <PrimeraVez />

  async function bloquear() {
    if (!confirmarSalida()) return
    await llamar('sesion.bloquear', undefined)
    await qc.resetQueries() // borra datos de pacientes de la memoria y vuelve a preguntar la sesión
  }
  const irAlInicio = () => confirmarSalida() && navegar('/')

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Anchor component="button" onClick={irAlInicio} c="inherit" underline="never">
            <Title order={3}>Sistema Nutri</Title>
          </Anchor>
          <Group>
            {pathname !== '/' && (
              <Tooltip label="Inicio">
                <ActionIcon className="icono-animado" variant="light" size="lg" aria-label="Inicio" onClick={irAlInicio}>
                  <Casa />
                </ActionIcon>
              </Tooltip>
            )}
            {/* Muestra el modo al que se cambia: la luna en modo claro, el sol en modo oscuro */}
            <Tooltip label={oscuro ? 'Modo claro' : 'Modo oscuro'}>
              <ActionIcon className="icono-animado" variant="light" size="lg" aria-label={oscuro ? 'Modo claro' : 'Modo oscuro'} onClick={toggleColorScheme}>
                {oscuro ? <Brillo /> : <Luna />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Bloquear">
              <ActionIcon className="icono-animado" variant="light" size="lg" aria-label="Bloquear" onClick={bloquear}>
                <Candado />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/pacientes" element={<ListaPacientes />} />
          <Route path="/pacientes/nuevo" element={<FichaPaciente />} />
          <Route path="/pacientes/:id" element={<FichaPaciente />} />
          <Route path="/pacientes/:id/controles/:controlId" element={<PantallaControl />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={tema}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>
)
