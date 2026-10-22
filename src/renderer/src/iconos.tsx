import type { SVGProps } from 'react'
import './iconos.css'

// Íconos de itshover.com (trazos de Tabler, MIT). Se animan al pasar el mouse por el botón que los contiene
// (clase icono-animado); la animación está en iconos.css en vez de la librería motion.
type Props = { size?: number }

const Svg = ({ size = 22, ...resto }: Props & SVGProps<SVGSVGElement>) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...resto}
  />
)

export const Casa = (p: Props) => (
  <Svg {...p}>
    <path className="techo" d="M5 12l-2 0l9 -9l9 9l-2 0" />
    <path className="casa" d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
    <path className="puerta" d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
  </Svg>
)

export const Candado = (p: Props) => (
  <Svg {...p} style={{ overflow: 'visible' }}>
    <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" />
    <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
    <path className="grillete" d="M8 11v-4a4 4 0 1 1 8 0v4" />
  </Svg>
)

export const UsuarioMas = (p: Props) => (
  <Svg {...p}>
    <g className="avatar">
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h4" />
    </g>
    <g className="mas">
      <path d="M16 19h6" />
      <path d="M19 16v6" />
    </g>
  </Svg>
)

export const Grupo = (p: Props) => (
  <Svg {...p}>
    <g className="centro">
      <path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" />
    </g>
    <g className="derecha">
      <path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M17 10h2a2 2 0 0 1 2 2v1" />
    </g>
    <g className="izquierda">
      <path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M3 13v-1a2 2 0 0 1 2 -2h2" />
    </g>
  </Svg>
)

export const Brillo = (p: Props) => (
  <Svg {...p}>
    <path className="sol" d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <g className="rayos">
      {['M12 5l0 .01', 'M17 7l0 .01', 'M19 12l0 .01', 'M17 17l0 .01', 'M12 19l0 .01', 'M7 17l0 .01', 'M5 12l0 .01', 'M7 7l0 .01'].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  </Svg>
)

export const Luna = (p: Props) => (
  <Svg {...p} style={{ overflow: 'visible' }}>
    <path className="luna" d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
  </Svg>
)
