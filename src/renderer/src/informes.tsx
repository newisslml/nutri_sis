// Informes antropométricos del control: pentacompartimental (hoja ANT de la ficha maestra) y bicompartimental (hoja BI).
import { Alert, Badge, ColorSwatch, Group, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { useState, type ReactNode } from 'react'
import {
  PLIEGUES_6,
  PLIEGUES_8,
  bicompartimental,
  kerr,
  perfilPhantom,
  somatotipo,
  sumaPliegues,
  type DatosAntropometria,
  type MetodoMusculo
} from '../../calculo/antropometria'
import {
  clasificarGrasa,
  clasificarMusculo,
  estadoNutricional,
  pesoIdealKg,
  riesgoCardiovascular,
  type Clasificacion
} from '../../calculo/clasificacion'
import { evaluarPediatria } from '../../calculo/pediatria'
import type { Paciente } from '../../shared/contratos'
import { formatearEdad } from '../../shared/validaciones'
import { BarraClasificacion, COLOR_NIVEL, Dona, EvolucionPorSerie, GraficoPhantom, Somatocarta, colorCss, panel, type PanelEvolucion } from './graficos'
import { decimal, fechaCL, kilos, puntajeZ } from './formato'

export type PuntoEvolucion = { fecha: string; datos: DatosAntropometria }
type Props = {
  datos: DatosAntropometria | null
  paciente: Paciente
  fecha: string
  edadMeses: number | null
  semanaEmbarazo: number | null
  enfermedades: string
  evolucion: PuntoEvolucion[]
}

const Seccion = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <Paper withBorder p="md">
    <Title order={4} mb="sm">
      {titulo}
    </Title>
    {children}
  </Paper>
)
const Dato = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed">
      {titulo}
    </Text>
    <Text component="div" fw={600}>
      {children}
    </Text>
  </div>
)
const Etiqueta = ({ c, sinDato = 'No aplica a esta edad' }: { c: Clasificacion | null; sinDato?: string }) =>
  c ? (
    <Badge color={COLOR_NIVEL[c.nivel]} variant="light">
      {c.etiqueta}
    </Badge>
  ) : (
    <Text size="sm" c="dimmed" fw={400}>
      {sinDato}
    </Text>
  )
const Falta = ({ faltan }: { faltan: string[] }) => (
  <Text size="sm" c="dimmed">
    Falta: {faltan.join(', ')}
  </Text>
)

/** Evaluación con curvas de crecimiento (OMS y norma MINSAL); null desde los 19 años 1 mes. */
const evaluar = (datos: DatosAntropometria, paciente: Paciente, fecha: string) =>
  evaluarPediatria({
    ...datos,
    nacimiento: paciente.fechaNacimiento,
    fecha,
    cabezaCm: datos.medidas.perimetros.cabeza,
    cinturaCm: datos.medidas.perimetros.cintura,
    semanasGestacion: paciente.semanasGestacion,
    pesoNacerG: paciente.pesoNacerG
  })

function Antecedentes({
  datos,
  paciente,
  fecha,
  edadMeses,
  semanaEmbarazo,
  enfermedades
}: Omit<Props, 'datos' | 'evolucion'> & { datos: DatosAntropometria }) {
  const imc = datos.pesoKg / (datos.tallaCm / 100) ** 2
  const ped = evaluar(datos, paciente, fecha)
  return (
    <Paper withBorder p="md">
      <Title order={4}>
        {paciente.nombres} {paciente.apellidos}
      </Title>
      <Text size="sm" c="dimmed">
        {[
          edadMeses !== null && formatearEdad(edadMeses),
          ped?.edadCorregidaMeses != null && `${formatearEdad(ped.edadCorregidaMeses)} de edad corregida`,
          paciente.sexo === 'F' ? 'Femenino' : 'Masculino',
          fechaCL(fecha),
          paciente.disciplina
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {enfermedades && (
        <Text size="sm" lineClamp={2}>
          Morbilidades: {enfermedades}
        </Text>
      )}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mt="md">
        <Dato titulo="Peso">{decimal(datos.pesoKg)} kg</Dato>
        <Dato titulo="Talla">{decimal(datos.tallaCm)} cm</Dato>
        <Dato titulo="IMC">{decimal(imc)} kg/m²</Dato>
        {ped && !semanaEmbarazo ? (
          <Dato titulo="Calificación nutricional (MINSAL)">
            <Etiqueta c={ped.nutricional} sinDato="Talla fuera de la tabla P/T" />
          </Dato>
        ) : (
          <Dato titulo={semanaEmbarazo ? `IMC gestacional (Atalah, semana ${semanaEmbarazo})` : 'Estado nutricional (OMS)'}>
            <Etiqueta c={estadoNutricional(imc, datos.edad, semanaEmbarazo)} sinDato={semanaEmbarazo ? 'La curva parte en la semana 6' : undefined} />
          </Dato>
        )}
      </SimpleGrid>
      {ped && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} mt="md">
          {ped.indicadores.map((i) => (
            <Dato key={i.sigla} titulo={`${i.nombre} (${i.sigla})`}>
              {puntajeZ(i.z)} DE
            </Dato>
          ))}
          <Dato titulo="Calificación estatural (T/E)">
            <Etiqueta c={ped.estatural} />
          </Dato>
          {ped.cefalico && (
            <Dato titulo="Perímetro cefálico (PCe/E)">
              <Etiqueta c={ped.cefalico} />
            </Dato>
          )}
          {ped.cintura && (
            <Dato titulo="Perímetro de cintura (PC/E)">
              <Etiqueta c={ped.cintura} />
            </Dato>
          )}
        </SimpleGrid>
      )}
    </Paper>
  )
}

/** Indicadores comunes a ambos informes más los propios de cada uno. */
/** angosto: va en media pantalla, al lado de otra sección, con dos columnas de datos en vez de tres. */
function Indicadores({
  datos,
  paciente,
  fecha,
  extra,
  angosto = false
}: {
  datos: DatosAntropometria
  paciente: Paciente
  fecha: string
  extra: [string, ReactNode][]
  angosto?: boolean
}) {
  const { cintura, cadera } = datos.medidas.perimetros
  const ped = evaluar(datos, paciente, fecha)
  const ideal = ped ? (ped.pesoIdeal?.kg ?? null) : pesoIdealKg(datos.tallaCm, datos.sexo)
  const diferencia = datos.pesoKg - (ideal ?? 0)
  const filas: [string, ReactNode][] = [
    [
      'Riesgo cardiovascular (OMS, cintura)',
      cintura === undefined ? (
        <Text size="sm" c="dimmed" fw={400}>
          falta cintura
        </Text>
      ) : (
        <Group gap="xs">
          <Etiqueta c={riesgoCardiovascular(cintura, datos.sexo, datos.edad)} />
          <Text size="sm" c="dimmed" fw={400}>
            {decimal(cintura)} cm
          </Text>
        </Group>
      )
    ],
    [
      ped ? `Peso ideal (mediana ${ped.pesoIdeal?.segun ?? 'P/T'})` : 'Peso ideal (OMS)',
      ideal === null
        ? 'talla fuera de la tabla P/T'
        : `${kilos(ideal)} kg (${diferencia > 0 ? '+' : diferencia < 0 ? '−' : '±'}${kilos(Math.abs(diferencia))} kg)`
    ],
    ['Índice cintura/cadera', cintura !== undefined && cadera !== undefined ? kilos(cintura / cadera) : 'falta cintura o cadera'],
    ['Σ 6 pliegues', sumaMm(datos, PLIEGUES_6)],
    ...extra
  ]
  return (
    <Seccion titulo="Clasificaciones e indicadores">
      <SimpleGrid cols={angosto ? { base: 1, sm: 2 } : { base: 1, sm: 2, lg: 3 }}>
        {filas.map(([titulo, valor]) => (
          <Dato key={titulo} titulo={titulo}>
            {valor}
          </Dato>
        ))}
      </SimpleGrid>
    </Seccion>
  )
}

const sumaMm = (d: DatosAntropometria, sitios: typeof PLIEGUES_6) => {
  const s = sumaPliegues(d.medidas, sitios)
  return 'mm' in s ? `${decimal(s.mm)} mm` : `faltan ${s.faltan.length}`
}

// Perímetros que se siguen control a control (los más usados para ver cambios de masa muscular y grasa).
const PERIMETROS_EVOLUCION = [
  ['brazoContraido', 'Brazo contraído', 'red.6'],
  ['cintura', 'Cintura', 'grape.6'],
  ['cadera', 'Cadera', 'teal.6'],
  ['musloMedio', 'Muslo medio', 'blue.6'],
  ['pantorrilla', 'Pantorrilla', 'orange.6']
] as const

/** Paneles de medidas directas, comunes a ambos informes: Σ 6 pliegues y perímetros. */
const panelesMedidas = (puntos: PuntoEvolucion[]): PanelEvolucion[] => [
  panel(
    'Σ 6 pliegues',
    'green.6',
    puntos.map((p) => {
      const s = sumaPliegues(p.datos.medidas, PLIEGUES_6)
      return 'mm' in s ? s.mm : null
    }),
    'mm'
  ),
  {
    titulo: 'Perímetros',
    unidad: 'cm',
    paso: 10,
    series: PERIMETROS_EVOLUCION.map(([sitio, nombre, color]) => ({
      nombre,
      color,
      valores: puntos.map((p) => p.datos.medidas.perimetros[sitio] ?? null)
    })).filter((s) => s.valores.some((v) => v !== null))
  }
]

function Evolucion({ puntos, paneles }: { puntos: PuntoEvolucion[]; paneles: PanelEvolucion[] }) {
  return (
    <Seccion titulo="Evolución por control">
      {puntos.length < 2 ? (
        <Text size="sm" c="dimmed">
          La evolución aparece desde el segundo control con peso y talla.
        </Text>
      ) : (
        <EvolucionPorSerie fechas={puntos.map((p) => p.fecha)} paneles={paneles} />
      )}
    </Seccion>
  )
}

const SinDatos = () => <Alert color="blue">Ingrese fecha, peso y talla en la pestaña Antropometría para ver el informe.</Alert>

export function InformePentacompartimental({ datos, evolucion, ...resto }: Props) {
  if (!datos) return <SinDatos />
  const k = kerr(datos)
  const so = somatotipo(datos)
  const perfil = perfilPhantom(datos)
  const zPeso = perfil.find((g) => g.titulo === 'Composición corporal')!.puntos[0].z
  const kerrPorPunto = (kg: (r: Extract<typeof k, { resultado: unknown }>['resultado']) => number) =>
    evolucion.map((p) => {
      const r = kerr(p.datos)
      return 'faltan' in r ? null : kg(r.resultado)
    })
  const masas = [
    ['Masa adiposa', 'adiposa', 'yellow.6'],
    ['Masa muscular', 'muscular', 'red.6'],
    ['Masa residual', 'residual', 'blue.6'],
    ['Masa ósea', 'osea', 'gray.6'],
    ['Masa de la piel', 'piel', 'orange.6']
  ] as const

  return (
    <Stack>
      <Antecedentes datos={datos} {...resto} />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Seccion titulo="Composición corporal (Kerr, 1988)">
          {'faltan' in k ? (
            <Falta faltan={k.faltan} />
          ) : (
            <Stack align="center">
              <Dona partes={masas.map(([nombre, m, color]) => ({ nombre, pct: k.resultado[m].pct, color }))} centro={`${decimal(datos.pesoKg)} kg`} />
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Compartimiento</Table.Th>
                    <Table.Th ta="right">kg</Table.Th>
                    <Table.Th ta="right">%</Table.Th>
                    <Table.Th ta="right">Z</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {masas.map(([nombre, m, color]) => (
                    <Table.Tr key={m}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <ColorSwatch size={12} color={colorCss(color)} />
                          {nombre}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">{kilos(k.resultado[m].kg)}</Table.Td>
                      <Table.Td ta="right">{decimal(k.resultado[m].pct)} %</Table.Td>
                      <Table.Td ta="right">{m === 'piel' ? '—' : puntajeZ(k.resultado.z[m])}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr fw={700}>
                    <Table.Td>Masa total</Table.Td>
                    <Table.Td ta="right">{kilos(datos.pesoKg)}</Table.Td>
                    <Table.Td ta="right">100 %</Table.Td>
                    <Table.Td ta="right">{puntajeZ(zPeso)}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              <Text size="sm" c="dimmed">
                Suma de masas sin ajustar {kilos(k.resultado.pesoEstructuradoKg)} kg ({decimal((k.resultado.pesoEstructuradoKg / datos.pesoKg - 1) * 100)} %
                respecto al peso). El Z de la masa ósea sale de los diámetros del cuerpo.
              </Text>
            </Stack>
          )}
        </Seccion>
        <Seccion titulo="Somatotipo (Heath-Carter)">
          {'faltan' in so ? (
            <Falta faltan={so.faltan} />
          ) : (
            <Stack align="center">
              <Somatocarta x={so.resultado.x} y={so.resultado.y} />
              <SimpleGrid cols={3} w="100%">
                <Dato titulo="Endomorfia">{kilos(so.resultado.endo)}</Dato>
                <Dato titulo="Mesomorfia">{kilos(so.resultado.meso)}</Dato>
                <Dato titulo="Ectomorfia">{kilos(so.resultado.ecto)}</Dato>
              </SimpleGrid>
            </Stack>
          )}
        </Seccion>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Seccion titulo="Perfil Phantom (score Z)">
          <Stack>
            <GraficoPhantom grupos={perfil} />
            <Text size="sm" c="dimmed">
              Cada punto es la distancia, en desviaciones estándar, entre la medida y el Phantom de Ross y Wilson ajustado a la talla del paciente. La
              franja central es ±1; fuera de ±2 se marca en rojo.
            </Text>
          </Stack>
        </Seccion>
        <Indicadores
          datos={datos}
          paciente={resto.paciente}
          fecha={resto.fecha}
          angosto
          extra={[
            ['Σ 8 pliegues', sumaMm(datos, PLIEGUES_8)],
            ['Índice músculo/hueso', 'faltan' in k ? 'faltan medidas de Kerr' : kilos(k.resultado.muscular.kg / k.resultado.osea.kg)],
            ['Índice adiposo/muscular', 'faltan' in k ? 'faltan medidas de Kerr' : kilos(k.resultado.adiposa.kg / k.resultado.muscular.kg)]
          ]}
        />
      </SimpleGrid>
      <Evolucion
        puntos={evolucion}
        paneles={[
          panel('Peso', 'blue.6', evolucion.map((p) => p.datos.pesoKg)),
          panel('Masa adiposa', 'yellow.6', kerrPorPunto((r) => r.adiposa.kg)),
          panel('Masa muscular', 'red.6', kerrPorPunto((r) => r.muscular.kg)),
          ...panelesMedidas(evolucion),
          panel('Índice adiposo/muscular', 'cyan.6', kerrPorPunto((r) => r.adiposa.kg / r.muscular.kg), '', 0.1),
          panel('Índice músculo/hueso', 'indigo.6', kerrPorPunto((r) => r.muscular.kg / r.osea.kg), '', 0.1)
        ]}
      />
    </Stack>
  )
}

export function InformeBicompartimental({ datos, evolucion, ...resto }: Props) {
  const [metodo, setMetodo] = useState<MetodoMusculo>('estimado')
  if (!datos) return <SinDatos />
  const bi = bicompartimental(datos, metodo)
  const grasa = 'resultado' in bi ? clasificarGrasa(bi.resultado.grasa.pct, datos.edad, datos.sexo) : null
  const musculo = 'resultado' in bi ? clasificarMusculo(bi.resultado.muscular.pct, datos.sexo) : null
  const biPorPunto = (kg: (r: Extract<typeof bi, { resultado: unknown }>['resultado']) => number) =>
    evolucion.map((p) => {
      const r = bicompartimental(p.datos, metodo)
      return 'faltan' in r ? null : kg(r.resultado)
    })
  const masas = [
    ['Masa grasa', 'grasa', 'yellow.6'],
    ['Masa muscular', 'muscular', 'red.6'],
    ['Masa residual/ósea', 'residual', 'gray.6']
  ] as const

  return (
    <Stack>
      <Antecedentes datos={datos} {...resto} />
      <Seccion titulo="Composición corporal (bicompartimental)">
        <SegmentedControl
          mb="md"
          data={[
            { value: 'estimado', label: 'Músculo: 0,56 × masa libre de grasa' },
            { value: 'lee', label: 'Músculo: Lee (perímetros)' }
          ]}
          value={metodo}
          onChange={(v) => setMetodo(v as MetodoMusculo)}
        />
        {'faltan' in bi ? (
          <Falta faltan={bi.faltan} />
        ) : (
          <Group align="center" gap="xl">
            <Dona partes={masas.map(([nombre, m, color]) => ({ nombre, pct: bi.resultado[m].pct, color }))} centro={`${decimal(datos.pesoKg)} kg`} />
            <Stack flex={1} miw={280}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Compartimiento</Table.Th>
                    <Table.Th ta="right">kg</Table.Th>
                    <Table.Th ta="right">%</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {masas.map(([nombre, m, color]) => (
                    <Table.Tr key={m}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <ColorSwatch size={12} color={colorCss(color)} />
                          {nombre}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">{kilos(bi.resultado[m].kg)}</Table.Td>
                      <Table.Td ta="right">{decimal(bi.resultado[m].pct)} %</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr fw={700}>
                    <Table.Td>Masa total</Table.Td>
                    <Table.Td ta="right">{kilos(datos.pesoKg)}</Table.Td>
                    <Table.Td ta="right">100 %</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              <Text size="sm" c="dimmed">
                Grasa por Durnin-Womersley (4 pliegues) y Siri.
              </Text>
              {bi.resultado.avisos.map((a) => (
                <Alert key={a} color="yellow">
                  {a}
                </Alert>
              ))}
            </Stack>
          </Group>
        )}
      </Seccion>
      {'resultado' in bi && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Seccion titulo="Masa grasa">
            <Stack>
              <Group gap="xs">
                <Text size="sm">Clasificación:</Text>
                <Etiqueta c={grasa} />
              </Group>
              {grasa && <BarraClasificacion valor={bi.resultado.grasa.pct} desde={0} hasta={60} {...grasa} />}
            </Stack>
          </Seccion>
          <Seccion titulo="Masa muscular">
            <Stack>
              <Group gap="xs">
                <Text size="sm">Clasificación:</Text>
                <Etiqueta c={musculo} />
              </Group>
              {musculo && <BarraClasificacion valor={bi.resultado.muscular.pct} desde={20} hasta={70} {...musculo} />}
            </Stack>
          </Seccion>
        </SimpleGrid>
      )}
      <Indicadores
        datos={datos}
        paciente={resto.paciente}
        fecha={resto.fecha}
        extra={[
          [
            'Índice adiposo/muscular',
            'resultado' in bi ? kilos(bi.resultado.grasa.kg / bi.resultado.muscular.kg) : 'faltan medidas'
          ]
        ]}
      />
      <Evolucion
        puntos={evolucion}
        paneles={[
          panel('Peso', 'blue.6', evolucion.map((p) => p.datos.pesoKg)),
          panel('Masa grasa', 'yellow.6', biPorPunto((r) => r.grasa.kg)),
          panel('Masa muscular', 'red.6', biPorPunto((r) => r.muscular.kg)),
          ...panelesMedidas(evolucion),
          panel('Índice adiposo/muscular', 'cyan.6', biPorPunto((r) => r.grasa.kg / r.muscular.kg), '', 0.1)
        ]}
      />
    </Stack>
  )
}
