import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services'
import type { FiltrosEquipos } from '../services'
import type { Almacen, Equipo } from '../types/api'
import {
  ESTATUS_CONDICION,
  ESTATUS_UBICACION,
  ETIQUETA_CONDICION,
  ETIQUETA_UBICACION,
  type EstatusCondicion,
  type EstatusUbicacion,
} from '../types/estatus'
import { Cargando, MensajeError, TarjetaEquipo } from './ui'

interface Props {
  // Fija el almacén (vista "Mi almacén" del encargado). Si viene undefined y
  // conAlmacenes=true, se muestra el selector (vista de reportes del admin).
  almacenFijo?: string
  conAlmacenes?: boolean
  conTotales?: boolean
}

// Lista de equipos con filtros, búsqueda, totales y paginación. La comparten
// Reportes (ADMIN, global) y Mi almacén (ENCARGADO/ADMIN, un almacén).
export function ListaEquipos({ almacenFijo, conAlmacenes = false, conTotales = false }: Props) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [pagina, setPagina] = useState(1)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [almacenId, setAlmacenId] = useState(almacenFijo ?? '')
  const [ubicacion, setUbicacion] = useState<'' | EstatusUbicacion>('')
  const [condicion, setCondicion] = useState<'' | EstatusCondicion>('')
  const [busqueda, setBusqueda] = useState('')

  const POR_PAGINA = 50

  // Guardia de carrera: cambiar filtros rápido lanza varias peticiones y la
  // más vieja puede llegar al final, pisando la lista con datos rancios.
  // Solo la respuesta de la petición más reciente toca el estado.
  const secuencia = useRef(0)

  useEffect(() => {
    if (conAlmacenes || almacenFijo) {
      void api.almacenes().then((r) => setAlmacenes(r.data)).catch(() => undefined)
    }
  }, [conAlmacenes, almacenFijo])

  const cargar = useCallback(
    async (paginaPedida: number, acumular: boolean) => {
      setCargando(true)
      setError('')
      const filtros: FiltrosEquipos = {
        page: paginaPedida,
        per_page: POR_PAGINA,
      }
      const efectivo = almacenFijo ?? almacenId
      if (efectivo) filtros.almacen_id = efectivo
      if (ubicacion) filtros.estatus_ubicacion = ubicacion
      if (condicion) filtros.estatus_condicion = condicion
      if (busqueda.trim()) filtros.q = busqueda.trim()
      const pedido = ++secuencia.current
      try {
        const r = await api.listarEquipos(filtros)
        if (pedido !== secuencia.current) return
        setEquipos((prev) => (acumular ? [...prev, ...r.data] : r.data))
        setHayMas(r.has_more)
        setPagina(paginaPedida)
      } catch (e: any) {
        if (pedido !== secuencia.current) return
        setError(e?.message ?? 'No se pudo cargar el inventario')
      } finally {
        if (pedido === secuencia.current) setCargando(false)
      }
    },
    [almacenFijo, almacenId, ubicacion, condicion, busqueda],
  )

  // Recarga con debounce al cambiar filtros o búsqueda.
  useEffect(() => {
    const t = window.setTimeout(() => void cargar(1, false), 300)
    return () => window.clearTimeout(t)
  }, [cargar])

  // Totales sobre lo cargado (la muestra visible; suficiente para el demo).
  const totalPorCondicion = (c: EstatusCondicion) =>
    equipos.filter((e) => e.estatus_condicion === c).length
  const totalPorUbicacion = (u: EstatusUbicacion) =>
    equipos.filter((e) => e.estatus_ubicacion === u).length

  const select =
    'h-11 rounded-lg border border-borde bg-white px-2 text-sm font-medium text-tinta shadow-carta focus:border-cian focus:outline-none'

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="space-y-2">
        <input
          className="h-12 w-full rounded-xl border border-borde bg-white px-4 text-tinta shadow-carta placeholder:text-tinta-3 focus:border-cian focus:outline-none"
          placeholder="Buscar por serial, activo o modelo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          {conAlmacenes && !almacenFijo && (
            <select className={select} value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
              <option value="">Todos los almacenes</option>
              {almacenes.map((a) => (
                <option key={a.ROWID} value={a.ROWID}>
                  {a.nombre}
                </option>
              ))}
            </select>
          )}
          <select
            className={select}
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value as '' | EstatusUbicacion)}
          >
            <option value="">Ubicación: todas</option>
            {ESTATUS_UBICACION.map((u) => (
              <option key={u} value={u}>
                {ETIQUETA_UBICACION[u]}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={condicion}
            onChange={(e) => setCondicion(e.target.value as '' | EstatusCondicion)}
          >
            <option value="">Condición: todas</option>
            {ESTATUS_CONDICION.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CONDICION[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Totales */}
      {conTotales && equipos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Total etiqueta="Equipos" valor={equipos.length + (hayMas ? '+' : '')} color="text-tinta" />
          <Total etiqueta="Operativos" valor={totalPorCondicion('OPERATIVO')} color="text-exito-tx" />
          <Total etiqueta="En reparación" valor={totalPorUbicacion('EN_REPARACION')} color="text-alerta-tx" />
          <Total etiqueta="Chatarra" valor={totalPorCondicion('CHATARRA')} color="text-peligro-tx" />
        </div>
      )}

      {error && <MensajeError texto={error} />}

      {/* Lista */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {equipos.map((e) => (
          <TarjetaEquipo key={e.ROWID} equipo={e} />
        ))}
      </div>

      {cargando && <Cargando texto="Cargando inventario…" />}

      {!cargando && equipos.length === 0 && !error && (
        <p className="py-10 text-center text-sm text-tinta-3">
          Sin equipos con estos filtros. Los equipos dados de alta al escanear aparecerán aquí.
        </p>
      )}

      {hayMas && !cargando && (
        <button
          type="button"
          className="h-12 w-full rounded-xl bg-white font-bold text-tinta shadow-carta ring-1 ring-borde active:bg-cian-50"
          onClick={() => void cargar(pagina + 1, true)}
        >
          Cargar más
        </button>
      )}
    </div>
  )
}

function Total({ etiqueta, valor, color }: { etiqueta: string; valor: number | string; color: string }) {
  return (
    <div className="rounded-carta border border-borde bg-white p-3 text-center shadow-carta">
      <p className={`text-2xl font-black ${color}`}>{valor}</p>
      <p className="text-xs text-tinta-2">{etiqueta}</p>
    </div>
  )
}
