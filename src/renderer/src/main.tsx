import '@mantine/core/styles.css'
import {
  ActionIcon,
  Anchor,
  AppShell,
  Box,
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
import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { confirmarSalida, llamar } from './api'
import { PantallaConfiguracion } from './configuracion'
import { PantallaControl } from './controles'
import { Brillo, Candado, Casa, Engranaje, Luna } from './iconos'
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

const ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const

/** Llama a alVencer tras `minutos` sin mouse ni teclado; 0 no vigila. */
function useInactividad(minutos: number, alVencer: () => void) {
  const vencer = useRef(alVencer)
  vencer.current = alVencer
  useEffect(() => {
    if (!minutos) return
    let reloj = setTimeout(() => vencer.current(), minutos * 60_000)
    const reiniciar = () => {
      clearTimeout(reloj)
      reloj = setTimeout(() => vencer.current(), minutos * 60_000)
    }
    for (const e of ACTIVIDAD) window.addEventListener(e, reiniciar, { passive: true })
    return () => {
      clearTimeout(reloj)
      for (const e of ACTIVIDAD) window.removeEventListener(e, reiniciar)
    }
  }, [minutos])
}

function App() {
  const qc = useQueryClient()
  const sesion = useQuery({ queryKey: ['sesion'], queryFn: () => llamar('sesion.estado', undefined) })
  const abierta = sesion.data?.abierta ?? false
  const config = useQuery({ queryKey: ['configuracion'], queryFn: () => llamar('configuracion.obtener', undefined), enabled: abierta })
  // Bloqueo por inactividad: cierra la base pero deja la pantalla montada y oculta, para no perder lo que no se ha guardado.
  const [inactiva, setInactiva] = useState(false)
  useInactividad(abierta && !inactiva ? (config.data?.minutosBloqueo ?? 0) : 0, async () => {
    await llamar('sesion.bloquear', undefined)
    setInactiva(true)
  })
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const { toggleColorScheme } = useMantineColorScheme()
  const oscuro = useComputedColorScheme('light') === 'dark' // Mantine lo recuerda en localStorage

  if (!sesion.data) return <Center h="100vh"><Loader /></Center>
  if (!sesion.data.abierta && !inactiva) return sesion.data.configurada ? <Desbloqueo /> : <PrimeraVez />

  async function bloquear() {
    if (!confirmarSalida()) return
    await llamar('sesion.bloquear', undefined)
    await qc.resetQueries() // borra datos de pacientes de la memoria y vuelve a preguntar la sesión
  }
  const irAlInicio = () => confirmarSalida() && navegar('/')
  const alReabrir = () => {
    setInactiva(false)
    qc.invalidateQueries({ predicate: (q) => q.state.status === 'error' }) // lo que falló mientras estaba bloqueada
  }

  return (
    <>
    {/* Capa fija sobre todo, también sobre los modales abiertos (van en un portal fuera de la pantalla oculta). */}
    {inactiva && (
      <Box pos="fixed" inset={0} bg="var(--mantine-color-body)" style={{ zIndex: 1000, overflowY: 'auto' }}>
        <Desbloqueo alAbrir={alReabrir} />
      </Box>
    )}
    <AppShell header={{ height: 56 }} padding="md" display={inactiva ? 'none' : undefined}>
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
            <Tooltip label="Configuración">
              <ActionIcon
                className="icono-animado"
                variant="light"
                size="lg"
                aria-label="Configuración"
                onClick={() => confirmarSalida() && navegar('/configuracion')}
              >
                <Engranaje />
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
          <Route path="/configuracion" element={<PantallaConfiguracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
    </>
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
