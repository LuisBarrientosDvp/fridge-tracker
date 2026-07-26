import { Link } from 'react-router'
import type { Equipo } from '../types/api'
import {
  COLOR_CONDICION,
  COLOR_UBICACION,
  ETIQUETA_CONDICION,
  ETIQUETA_UBICACION,
} from '../types/estatus'

// Piezas de interfaz compartidas. Mobile-first: targets grandes, contraste
// alto, nada de hovers como única señal.

export function InsigniaUbicacion({ equipo }: { equipo: Equipo }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${COLOR_UBICACION[equipo.estatus_ubicacion]}`}
    >
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${COLOR_CONDICION[equipo.estatus_condicion]}`}
    >
      {ETIQUETA_CONDICION[equipo.estatus_condicion]}
    </span>
  )
}

// Cabecera estándar de página con regreso al menú.
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
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        {volverA !== null && (
          <Link
            to={volverA}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-200 active:bg-slate-700"
            aria-label="Volver"
          >
            ←
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-100">{titulo}</h1>
          {subtitulo && <p className="truncate text-xs text-slate-400">{subtitulo}</p>}
        </div>
      </div>
    </header>
  )
}

export function TarjetaEquipo({ equipo }: { equipo: Equipo }) {
  return (
    <Link
      to={`/equipos/${equipo.ROWID}`}
      className="block rounded-xl bg-slate-800/80 p-4 ring-1 ring-slate-700 active:bg-slate-700/80"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-bold text-slate-100">
          {equipo.marca}
          {equipo.modelo ? ` · ${equipo.modelo}` : ''}
        </p>
        <span className="shrink-0 text-xs text-slate-400">{equipo.equipo_tipo}</span>
      </div>
      <p className="mb-2 truncate font-mono text-sm text-slate-300">
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
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

export function MensajeError({ texto }: { texto: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-300 ring-1 ring-red-500/30">
      {texto}
    </div>
  )
}
