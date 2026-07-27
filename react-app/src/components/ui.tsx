import { Link } from 'react-router'
import { device } from '../services'
import type { Equipo } from '../types/api'
import {
  COLOR_CONDICION,
  COLOR_UBICACION,
  ETIQUETA_CONDICION,
  ETIQUETA_UBICACION,
  PUNTO_CONDICION,
  PUNTO_UBICACION,
} from '../types/estatus'

// Piezas de interfaz compartidas. Mobile-first: targets grandes, contraste
// alto, nada de hovers como única señal. Estilo del design system: pastillas
// claras con punto de color, tarjetas blancas con borde suave.

// Recetas de clases compartidas (una sola definición; antes cada página
// repetía la suya con pequeñas variaciones).
export const CAMPO =
  'w-full rounded-xl border border-borde bg-white p-3 text-tinta shadow-carta placeholder:text-tinta-3 focus:border-cian focus:outline-none disabled:bg-panel disabled:text-tinta-3'

export const BOTON_SECUNDARIO =
  'rounded-xl bg-white px-4 py-2.5 font-semibold text-tinta shadow-carta ring-1 ring-borde active:bg-panel'

// Copo de nieve del design system (trazo cian claro sobre marino).
export function LogoCopo({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7FE3EF"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="m8 5 4 3 4-3" />
      <path d="m8 19 4-3 4 3" />
      <line x1="2.5" y1="7" x2="21.5" y2="17" />
      <line x1="2.5" y1="17" x2="21.5" y2="7" />
    </svg>
  )
}

export function InsigniaUbicacion({ equipo }: { equipo: Equipo }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_UBICACION[equipo.estatus_ubicacion]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PUNTO_UBICACION[equipo.estatus_ubicacion]}`} />
      {ETIQUETA_UBICACION[equipo.estatus_ubicacion]}
      {equipo.estatus_ubicacion === 'EN_REPARACION' && equipo.reparacion_tipo
        ? ` · ${equipo.reparacion_tipo === 'INTERNA' ? 'interna' : 'externa'}`
        : ''}
    </span>
  )
}

export function InsigniaCondicion({ equipo }: { equipo: Equipo }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_CONDICION[equipo.estatus_condicion]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PUNTO_CONDICION[equipo.estatus_condicion]}`} />
      {ETIQUETA_CONDICION[equipo.estatus_condicion]}
    </span>
  )
}

// Nota de dispositivo para las barras superiores: PC / Android / iOS / Móvil.
export function EtiquetaDispositivo() {
  return (
    <span className="shrink-0 rounded-full bg-marino-700/60 px-2.5 py-1 text-[11px] font-medium text-marino-300">
      Dispositivo: {device.tipo()}
    </span>
  )
}

// Cabecera estándar de página: barra marina del design system.
export function Cabecera({
  titulo,
  subtitulo,
  volverA = '/menu',
}: {
  titulo: string
  subtitulo?: string
  volverA?: string | null
}) {
  return (
    <header className="sticky top-0 z-30 bg-marino px-4 py-3 text-white shadow-marino">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        {volverA !== null && (
          <Link
            to={volverA}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marino-700/60 text-xl text-white active:bg-marino-700"
            aria-label="Volver"
          >
            ←
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{titulo}</h1>
          {subtitulo && <p className="truncate text-xs text-marino-300">{subtitulo}</p>}
        </div>
        <div className="ml-auto">
          <EtiquetaDispositivo />
        </div>
      </div>
    </header>
  )
}

export function TarjetaEquipo({ equipo }: { equipo: Equipo }) {
  return (
    <Link
      to={`/equipos/${equipo.ROWID}`}
      className="block rounded-carta border border-borde bg-white p-4 shadow-carta active:bg-cian-50"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-bold text-tinta">
          {equipo.marca}
          {equipo.modelo ? ` · ${equipo.modelo}` : ''}
        </p>
        <span className="shrink-0 text-xs text-tinta-2">{equipo.equipo_tipo}</span>
      </div>
      <p className="mb-2 truncate font-mono text-sm text-tinta-2">
        {equipo.serial || 'sin serial'}
        {equipo.num_activo ? `  ·  activo ${equipo.num_activo}` : ''}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <InsigniaUbicacion equipo={equipo} />
        <InsigniaCondicion equipo={equipo} />
      </div>
    </Link>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-tinta-2">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-borde border-t-cian" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

export function MensajeError({ texto }: { texto: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-peligro-bg p-4 text-center text-sm font-medium text-peligro-tx">
      {texto}
    </div>
  )
}
