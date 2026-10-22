// Gráficos del informe antropométrico. Usan variables CSS de Mantine para seguir el modo claro y oscuro.
import { RingProgress, Stack, Text } from '@mantine/core'
import type { PerfilPhantom } from '../../calculo/antropometria'
import type { Nivel } from '../../calculo/clasificacion'
import { decimal, fechaCL, puntajeZ } from './formato'

/** "red.6" → var(--mantine-color-red-6) */
export const colorCss = (c: string) => `var(--mantine-color-${c.replace('.', '-')})`
export const COLOR_NIVEL: Record<Nivel, string> = { ok: 'green', atencion: 'yellow', riesgo: 'red' }

export function Dona({ partes, centro }: { partes: { nombre: string; pct: number; color: string }[]; centro: string }) {
  return (
    <RingProgress
      size={190}
      thickness={26}
      sections={partes.map((p) => ({ value: Math.max(0, p.pct), color: p.color, tooltip: `${p.nombre}: ${decimal(p.pct)} %` }))}
      label={
        <Text ta="center" size="sm" fw={600}>
          {centro}
        </Text>
      }
    />
  )
}

/** Barra de tramos de colores con una flecha en el valor del paciente. */
export function BarraClasificacion(p: { valor: number; desde: number; hasta: number; cortes: number[]; etiquetas: string[]; niveles: Nivel[] }) {
  const limites = [p.desde, ...p.cortes, p.hasta]
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - p.desde) / (p.hasta - p.desde)) * 100))}%`
  const ancho = (i: number) => `${((limites[i + 1] - limites[i]) / (p.hasta - p.desde)) * 100}%`
  const rango = (i: number) =>
    i === 0 ? `< ${decimal(p.cortes[0])}` : i === p.cortes.length ? `≥ ${decimal(p.cortes[i - 1])}` : `${decimal(p.cortes[i - 1])} – ${decimal(p.cortes[i])}`
  return (
    <div>
      <div style={{ position: 'relative', height: 42 }}>
        <Text size="xs" fw={700} style={{ position: 'absolute', left: pos(p.valor), top: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          {decimal(p.valor)} %
        </Text>
        <div
          style={{
            position: 'absolute',
            left: pos(p.valor),
            top: 18,
            transform: 'translateX(-50%)',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '9px solid var(--mantine-color-text)'
          }}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 12, display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
          {p.etiquetas.map((e, i) => (
            <div key={e} style={{ width: ancho(i), background: colorCss(`${COLOR_NIVEL[p.niveles[i]]}.6`) }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 4 }}>
        {p.etiquetas.map((e, i) => (
          <div key={e} style={{ width: ancho(i), textAlign: 'center' }}>
            <Text size="xs" fw={600}>
              {e}
            </Text>
            <Text size="xs" c="dimmed">
              {rango(i)}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

const Z_MAX = 4
const posZ = (z: number) => `${((Math.min(Z_MAX, Math.max(-Z_MAX, z)) + Z_MAX) / (2 * Z_MAX)) * 100}%`
const MARCAS_Z = [-3, -2, -1, 0, 1, 2, 3]
const FILA_Z = { display: 'grid', gridTemplateColumns: '170px 1fr 56px', alignItems: 'center', gap: 8 }

/** Un punto por medida sobre una escala de −4 a +4 desviaciones estándar; la franja central es ±1. */
export function GraficoPhantom({ grupos }: { grupos: PerfilPhantom }) {
  return (
    <Stack gap="md">
      <div style={FILA_Z}>
        <span />
        <div style={{ position: 'relative', height: 16 }}>
          {MARCAS_Z.map((v) => (
            <Text key={v} size="xs" c="dimmed" style={{ position: 'absolute', left: posZ(v), transform: 'translateX(-50%)' }}>
              {v > 0 ? `+${v}` : v}
            </Text>
          ))}
        </div>
        <span />
      </div>
      {grupos.map((g) => (
        <Stack gap={4} key={g.titulo}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {g.titulo}
          </Text>
          {g.puntos.map((p) => {
            const fuera = Math.abs(p.z) > 2
            return (
              <div key={p.nombre} style={FILA_Z}>
                <Text size="sm">{p.nombre}</Text>
                <div style={{ position: 'relative', height: 22 }}>
                  <div style={{ position: 'absolute', left: posZ(-1), width: '25%', top: 0, bottom: 0, background: 'var(--mantine-primary-color-light)' }} />
                  {MARCAS_Z.map((v) => (
                    <div
                      key={v}
                      style={{
                        position: 'absolute',
                        left: posZ(v),
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: v === 0 ? 'var(--mantine-color-dimmed)' : 'var(--mantine-color-default-border)'
                      }}
                    />
                  ))}
                  <div
                    title={`${p.nombre}: ${puntajeZ(p.z)}`}
                    style={{
                      position: 'absolute',
                      left: posZ(p.z),
                      top: '50%',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: fuera ? colorCss('red.6') : 'var(--mantine-primary-color-filled)',
                      border: '2px solid var(--mantine-color-body)'
                    }}
                  />
                </div>
                <Text size="sm" ta="right" fw={600} c={fuera ? 'red' : undefined}>
                  {puntajeZ(p.z)}
                </Text>
              </div>
            )
          })}
        </Stack>
      ))}
    </Stack>
  )
}

const [SOMA_W, SOMA_H, SOMA_M] = [320, 380, 26]
const SOMA_X = [-9, 9]
const SOMA_Y = [-12, 16]
const somaPx = (v: number) => SOMA_M + ((Math.min(SOMA_X[1], Math.max(SOMA_X[0], v)) - SOMA_X[0]) / (SOMA_X[1] - SOMA_X[0])) * (SOMA_W - 2 * SOMA_M)
const somaPy = (v: number) => SOMA_M + ((SOMA_Y[1] - Math.min(SOMA_Y[1], Math.max(SOMA_Y[0], v))) / (SOMA_Y[1] - SOMA_Y[0])) * (SOMA_H - 2 * SOMA_M)
const rango = (desde: number, hasta: number, paso: number) => Array.from({ length: Math.floor((hasta - desde) / paso) + 1 }, (_, i) => desde + i * paso)

/** Somatocarta: x = ectomorfia − endomorfia, y = 2 × mesomorfia − (endomorfia + ectomorfia). */
export function Somatocarta({ x, y }: { x: number; y: number }) {
  const texto = { fill: 'var(--mantine-color-dimmed)', fontSize: 10 }
  return (
    <svg viewBox={`0 0 ${SOMA_W} ${SOMA_H}`} role="img" aria-label={`Somatocarta, x ${decimal(x)}, y ${decimal(y)}`} style={{ width: '100%', maxWidth: 360 }}>
      {rango(-8, 8, 2).map((v) => (
        <line key={`x${v}`} x1={somaPx(v)} x2={somaPx(v)} y1={somaPy(SOMA_Y[1])} y2={somaPy(SOMA_Y[0])} stroke={v === 0 ? 'var(--mantine-color-dimmed)' : 'var(--mantine-color-default-border)'} />
      ))}
      {rango(-12, 16, 2).map((v) => (
        <line key={`y${v}`} y1={somaPy(v)} y2={somaPy(v)} x1={somaPx(SOMA_X[0])} x2={somaPx(SOMA_X[1])} stroke={v === 0 ? 'var(--mantine-color-dimmed)' : 'var(--mantine-color-default-border)'} />
      ))}
      {rango(-8, 8, 4).map((v) => (
        <text key={`tx${v}`} x={somaPx(v)} y={SOMA_H - 8} textAnchor="middle" {...texto}>
          {v}
        </text>
      ))}
      {rango(-12, 16, 4).map((v) => (
        <text key={`ty${v}`} x={6} y={somaPy(v) + 3} {...texto}>
          {v}
        </text>
      ))}
      <text x={somaPx(-5.5)} y={somaPy(-9)} textAnchor="middle" {...texto} fontSize={11} fontWeight={600}>
        Endomorfia
      </text>
      <text x={somaPx(5.5)} y={somaPy(-9)} textAnchor="middle" {...texto} fontSize={11} fontWeight={600}>
        Ectomorfia
      </text>
      <text x={somaPx(0)} y={somaPy(14.5)} textAnchor="middle" {...texto} fontSize={11} fontWeight={600}>
        Mesomorfia
      </text>
      <circle cx={somaPx(x)} cy={somaPy(y)} r={7} fill="var(--mantine-primary-color-filled)" stroke="var(--mantine-color-body)" strokeWidth={2}>
        <title>{`x ${decimal(x)} · y ${decimal(y)}`}</title>
      </circle>
    </svg>
  )
}

export type SerieEvolucion = { nombre: string; color: string; valores: (number | null)[] }
const [EV_W, EV_H, EV_IZQ, EV_DER, EV_ARR, EV_ABA] = [640, 260, 40, 16, 12, 34]

/** Líneas de kg por control, con las fechas repartidas a igual distancia; un valor null deja un corte en la línea. */
export function GraficoEvolucion({ fechas, series }: { fechas: string[]; series: SerieEvolucion[] }) {
  const tope = Math.ceil(Math.max(1, ...series.flatMap((s) => s.valores.filter((v) => v !== null))) / 20) * 20
  const px = (i: number) => EV_IZQ + (fechas.length === 1 ? 0.5 : i / (fechas.length - 1)) * (EV_W - EV_IZQ - EV_DER)
  const py = (v: number) => EV_ARR + (1 - v / tope) * (EV_H - EV_ARR - EV_ABA)
  const trazo = (vs: (number | null)[]) =>
    vs.reduce((d, v, i) => (v === null ? d : `${d}${i > 0 && vs[i - 1] !== null ? 'L' : 'M'}${px(i)} ${py(v)}`), '')
  const cadaCuantas = Math.ceil(fechas.length / 8)
  const texto = { fill: 'var(--mantine-color-dimmed)', fontSize: 11 }
  return (
    <svg viewBox={`0 0 ${EV_W} ${EV_H}`} role="img" aria-label="Evolución por control" style={{ width: '100%', maxWidth: 760 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={EV_IZQ} x2={EV_W - EV_DER} y1={py((tope * i) / 4)} y2={py((tope * i) / 4)} stroke="var(--mantine-color-default-border)" />
          <text x={EV_IZQ - 6} y={py((tope * i) / 4) + 4} textAnchor="end" {...texto}>
            {(tope * i) / 4}
          </text>
        </g>
      ))}
      {fechas.map((f, i) =>
        i % cadaCuantas === 0 ? (
          <text key={f + i} x={px(i)} y={EV_H - 12} textAnchor="middle" {...texto}>
            {fechaCL(f)}
          </text>
        ) : null
      )}
      {series.map((s) => (
        <g key={s.nombre} stroke={colorCss(s.color)} fill={colorCss(s.color)}>
          <path d={trazo(s.valores)} fill="none" strokeWidth={2.5} strokeLinejoin="round" />
          {s.valores.map((v, i) =>
            v === null ? null : (
              <circle key={i} cx={px(i)} cy={py(v)} r={4} stroke="var(--mantine-color-body)" strokeWidth={1.5}>
                <title>{`${s.nombre} · ${fechaCL(fechas[i])}: ${decimal(v)} kg`}</title>
              </circle>
            )
          )}
        </g>
      ))}
    </svg>
  )
}
