import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { BuscadorLugar } from '../components/BuscadorLugar'
import { Cabecera, Cargando, InsigniaCondicion, InsigniaUbicacion, MensajeError } from '../components/ui'
import { useSesion } from '../context/SesionContext'
import { api, location } from '../services'
import type { CambioEstatus } from '../services'
import type { Almacen, CodigoEquipo, Equipo, Movimiento } from '../types/api'
import {
  ESTATUS_CONDICION,
  ETIQUETA_CONDICION,
  ETIQUETA_UBICACION,
  type EstatusCondicion,
} from '../types/estatus'

type Panel =
  | null
  | 'ubicacion' // elegir EN_ALMACEN / EN_UBICACION / EN_REPARACION
  | 'lugar-venta' // buscador de punto de venta
  | 'reparacion' // interna/externa
  | 'lugar-taller' // buscador de taller
  | 'condicion'
  | 'almacen' // solo ADMIN
  | 'qr'

const ETIQUETA_EVENTO: Record<Movimiento['tipo_evento'], string> = {
  ALTA: 'Alta',
  CAMBIO_UBICACION: 'Cambio de ubicación',
  CAMBIO_CONDICION: 'Cambio de condición',
  TRASLADO: 'Traslado de almacén',
  REPARACION: 'Reparación',
}

export default function FichaEquipoPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useSesion()
  const [equipo, setEquipo] = useState<Equipo | null>(null)
  const [codigos, setCodigos] = useState<CodigoEquipo[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const qrRef = useRef<HTMLCanvasElement>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    try {
      const r = await api.obtenerEquipo(id)
      setEquipo(r.equipo)
      setCodigos(r.codigos)
      setMovimientos(r.movimientos)
      setError('')
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el equipo')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void api
      .almacenes()
      .then((r) => setAlmacenes(r.data))
      .catch(() => setAlmacenes([]))
  }, [])

  // El QR codifica el SERIAL, no el ROWID (spec §8): entra por el mismo
  // resolvedor que el código de fábrica y sobrevive reimportaciones.
  useEffect(() => {
    if (panel === 'qr' && qrRef.current && equipo?.serial) {
      void QRCode.toCanvas(qrRef.current, equipo.serial, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
    }
  }, [panel, equipo])

  const mover = async (cambio: Omit<CambioEstatus, 'uuid_cliente' | 'fecha_evento'>) => {
    if (!id) return
    setGuardando(true)
    setAviso('')
    let gps: { lat: number; lng: number } | undefined
    try {
      const pos = await location.posicionActual()
      gps = { lat: pos.lat, lng: pos.lng }
    } catch {
      gps = undefined
    }
    try {
      await api.crearMovimiento(id, {
        ...cambio,
        // UUID generado en el cliente: llave de idempotencia (regla 3).
        uuid_cliente: crypto.randomUUID(),
        fecha_evento: new Date().toISOString(),
        lat: gps?.lat,
        lng: gps?.lng,
      })
      setPanel(null)
      setAviso('✓ Movimiento registrado')
      window.setTimeout(() => setAviso(''), 2500)
      await cargar()
    } catch (e: any) {
      setAviso(`Error: ${e?.message ?? 'no se pudo registrar'}`)
    } finally {
      setGuardando(false)
    }
  }

  const trasladar = async (almacenId: string) => {
    if (!id) return
    setGuardando(true)
    try {
      await api.cambiarAlmacen(id, almacenId)
      setPanel(null)
      setAviso('✓ Almacén actualizado')
      window.setTimeout(() => setAviso(''), 2500)
      await cargar()
    } catch (e: any) {
      setAviso(`Error: ${e?.message ?? 'no se pudo trasladar'}`)
    } finally {
      setGuardando(false)
    }
  }

  const descargarQR = () => {
    const canvas = qrRef.current
    if (!canvas || !equipo) return
    const enlace = document.createElement('a')
    enlace.download = `qr-${equipo.serial ?? equipo.ROWID}.png`
    enlace.href = canvas.toDataURL('image/png')
    enlace.click()
  }

  const nombreAlmacen = (rowid: string | null) =>
    almacenes.find((a) => a.ROWID === rowid)?.nombre ?? (rowid ? `#${rowid}` : '—')

  if (cargando) {
    return (
      <main className="min-h-dvh bg-slate-950">
        <Cabecera titulo="Ficha del equipo" />
        <Cargando />
      </main>
    )
  }
  if (!equipo) {
    return (
      <main className="min-h-dvh bg-slate-950 pt-6">
        <Cabecera titulo="Ficha del equipo" />
        <div className="p-4">
          <MensajeError texto={error || 'Equipo no encontrado'} />
        </div>
      </main>
    )
  }

  const esAdmin = usuario?.rol === 'ADMIN'

  return (
    <main className="min-h-dvh bg-slate-950 pb-16">
      <Cabecera
        titulo={`${equipo.marca}${equipo.modelo ? ` · ${equipo.modelo}` : ''}`}
        subtitulo={equipo.equipo_tipo}
      />

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {aviso && (
          <p
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              aviso.startsWith('✓')
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
            }`}
          >
            {aviso}
          </p>
        )}

        {/* Identificación */}
        <section className="rounded-2xl bg-slate-800/80 p-4 ring-1 ring-slate-700">
          <div className="mb-3 flex flex-wrap gap-2">
            <InsigniaUbicacion equipo={equipo} />
            <InsigniaCondicion equipo={equipo} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Serial</dt>
              <dd className="break-all font-mono text-slate-200">{equipo.serial ?? 'sin serial'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">No. activo</dt>
              <dd className="font-mono text-slate-200">{equipo.num_activo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Año</dt>
              <dd className="text-slate-200">{equipo.anio ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cerveza</dt>
              <dd className="text-slate-200">{equipo.cerveza ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Almacén casa</dt>
              <dd className="text-slate-200">{nombreAlmacen(equipo.almacen_id)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Origen</dt>
              <dd className="text-slate-200">
                {equipo.origen_registro === 'CAMPO' ? 'Alta en campo' : 'Importación'}
              </dd>
            </div>
          </dl>
          {codigos.length > 0 && (
            <p className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-500">
              Códigos:{' '}
              {codigos.map((c) => (
                <span key={c.ROWID} className="mr-2 font-mono text-slate-400">
                  {c.codigo} ({c.formato})
                </span>
              ))}
            </p>
          )}
        </section>

        {/* Acciones */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            className="h-20 rounded-xl bg-sky-500/15 text-sm font-bold text-sky-300 ring-1 ring-sky-500/30 active:bg-sky-500/25"
            onClick={() => setPanel('ubicacion')}
          >
            📍 Cambiar
            <br />
            ubicación
          </button>
          <button
            type="button"
            className="h-20 rounded-xl bg-amber-500/15 text-sm font-bold text-amber-300 ring-1 ring-amber-500/30 active:bg-amber-500/25"
            onClick={() => setPanel('condicion')}
          >
            🔧 Cambiar
            <br />
            condición
          </button>
          <button
            type="button"
            className="h-20 rounded-xl bg-slate-700/60 text-sm font-bold text-slate-200 ring-1 ring-slate-600 active:bg-slate-600 disabled:opacity-40"
            onClick={() => setPanel('qr')}
            disabled={!equipo.serial}
          >
            🏷 Etiqueta
            <br />
            QR
          </button>
          {esAdmin ? (
            <button
              type="button"
              className="h-20 rounded-xl bg-violet-500/15 text-sm font-bold text-violet-300 ring-1 ring-violet-500/30 active:bg-violet-500/25"
              onClick={() => setPanel('almacen')}
            >
              🏬 Cambiar
              <br />
              almacén
            </button>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-xl bg-slate-900 text-center text-xs text-slate-600 ring-1 ring-slate-800">
              Cambio de almacén:
              <br />
              solo admin
            </div>
          )}
        </section>

        {/* Historial */}
        <section>
          <h2 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Historial de movimientos
          </h2>
          <ol className="space-y-2">
            {movimientos.map((m) => (
              <li key={m.ROWID} className="rounded-xl bg-slate-800/60 p-3 ring-1 ring-slate-700/60">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-200">
                    {ETIQUETA_EVENTO[m.tipo_evento] ?? m.tipo_evento}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{m.fecha_evento}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-400">
                  {m.estatus_ubicacion_nuevo &&
                    `→ ${ETIQUETA_UBICACION[m.estatus_ubicacion_nuevo]}`}
                  {m.estatus_condicion_nuevo &&
                    ` → ${ETIQUETA_CONDICION[m.estatus_condicion_nuevo]}`}
                  {m.tipo_evento === 'TRASLADO' &&
                    ` ${nombreAlmacen(m.almacen_anterior_id)} → ${nombreAlmacen(m.almacen_nuevo_id)}`}
                </p>
                {m.nota && <p className="mt-1 text-sm italic text-slate-500">“{m.nota}”</p>}
              </li>
            ))}
            {movimientos.length === 0 && (
              <li className="rounded-xl bg-slate-900 p-4 text-center text-sm text-slate-600">
                Sin movimientos registrados
              </li>
            )}
          </ol>
        </section>
      </div>

      {/* ---------- paneles ---------- */}

      {panel === 'ubicacion' && (
        <PanelInferior titulo="¿Dónde queda el equipo?" onCerrar={() => setPanel(null)}>
          <BotonPanel
            emoji="🏬"
            texto="En almacén"
            detalle="Regresa o permanece en su almacén"
            deshabilitado={guardando}
            onClick={() => void mover({ estatus_ubicacion: 'EN_ALMACEN' })}
          />
          <BotonPanel
            emoji="🏪"
            texto="En punto de venta"
            detalle="Colocado en tienda o negocio"
            deshabilitado={guardando}
            onClick={() => setPanel('lugar-venta')}
          />
          <BotonPanel
            emoji="🔧"
            texto="En reparación"
            detalle="Interna o en taller externo"
            deshabilitado={guardando}
            onClick={() => setPanel('reparacion')}
          />
        </PanelInferior>
      )}

      {panel === 'lugar-venta' && (
        <BuscadorLugar
          tipo="PUNTO_VENTA"
          onCancelar={() => setPanel('ubicacion')}
          onElegir={(lugar) =>
            void mover({ estatus_ubicacion: 'EN_UBICACION', lugar_id: lugar.ROWID })
          }
        />
      )}

      {panel === 'reparacion' && (
        <PanelInferior titulo="Tipo de reparación" onCerrar={() => setPanel('ubicacion')}>
          <BotonPanel
            emoji="🏠"
            texto="Interna · mismo almacén"
            detalle="Se repara en su propio almacén"
            deshabilitado={guardando}
            onClick={() =>
              void mover({ estatus_ubicacion: 'EN_REPARACION', reparacion_tipo: 'INTERNA' })
            }
          />
          {almacenes
            .filter((a) => a.ROWID !== equipo.almacen_id)
            .map((a) => (
              <BotonPanel
                key={a.ROWID}
                emoji="🏭"
                texto={`Interna · ${a.nombre}`}
                detalle="Se repara en otro almacén"
                deshabilitado={guardando}
                onClick={() =>
                  void mover({
                    estatus_ubicacion: 'EN_REPARACION',
                    reparacion_tipo: 'INTERNA',
                    almacen_reparacion_id: a.ROWID,
                  })
                }
              />
            ))}
          <BotonPanel
            emoji="🛠"
            texto="Externa · taller"
            detalle="Elegir o crear el taller"
            deshabilitado={guardando}
            onClick={() => setPanel('lugar-taller')}
          />
        </PanelInferior>
      )}

      {panel === 'lugar-taller' && (
        <BuscadorLugar
          tipo="TALLER"
          onCancelar={() => setPanel('reparacion')}
          onElegir={(lugar) =>
            void mover({
              estatus_ubicacion: 'EN_REPARACION',
              reparacion_tipo: 'EXTERNA',
              lugar_id: lugar.ROWID,
            })
          }
        />
      )}

      {panel === 'condicion' && (
        <PanelInferior titulo="Condición del equipo" onCerrar={() => setPanel(null)}>
          {ESTATUS_CONDICION.map((c: EstatusCondicion) => (
            <BotonPanel
              key={c}
              emoji={c === 'OPERATIVO' ? '✅' : c === 'MANTENIMIENTO' ? '🔧' : c === 'REFURBISH' ? '♻️' : '🗑'}
              texto={ETIQUETA_CONDICION[c]}
              deshabilitado={guardando || equipo.estatus_condicion === c}
              onClick={() => void mover({ estatus_condicion: c })}
            />
          ))}
        </PanelInferior>
      )}

      {panel === 'almacen' && (
        <PanelInferior titulo="Trasladar a otro almacén" onCerrar={() => setPanel(null)}>
          {almacenes
            .filter((a) => a.ROWID !== equipo.almacen_id)
            .map((a) => (
              <BotonPanel
                key={a.ROWID}
                emoji="🏬"
                texto={a.nombre}
                detalle={a.municipio ?? undefined}
                deshabilitado={guardando}
                onClick={() => void trasladar(a.ROWID)}
              />
            ))}
        </PanelInferior>
      )}

      {panel === 'qr' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center">
            <h2 className="mb-1 text-lg font-bold text-slate-900">Etiqueta QR</h2>
            <p className="mb-3 break-all font-mono text-sm text-slate-500">{equipo.serial}</p>
            <canvas ref={qrRef} className="mx-auto aspect-square w-full max-w-[280px]" />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="h-12 flex-1 rounded-lg bg-slate-200 font-bold text-slate-800"
                onClick={() => setPanel(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="h-12 flex-1 rounded-lg bg-emerald-500 font-bold text-emerald-950"
                onClick={descargarQR}
              >
                ⬇ Descargar PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ---------- piezas locales ----------

function PanelInferior({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-slate-800 p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">{titulo}</h2>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300"
            onClick={onCerrar}
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  )
}

function BotonPanel({
  emoji,
  texto,
  detalle,
  deshabilitado,
  onClick,
}: {
  emoji: string
  texto: string
  detalle?: string
  deshabilitado?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl bg-slate-700/70 p-4 text-left active:bg-slate-600 disabled:opacity-40"
      disabled={deshabilitado}
      onClick={onClick}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block font-bold text-slate-100">{texto}</span>
        {detalle && <span className="block text-sm text-slate-400">{detalle}</span>}
      </span>
    </button>
  )
}
