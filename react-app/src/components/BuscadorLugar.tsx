import { useEffect, useRef, useState } from 'react'
import { api, location } from '../services'
import type { Lugar } from '../types/api'

interface Props {
  tipo: 'PUNTO_VENTA' | 'TALLER'
  onElegir: (lugar: Lugar) => void
  onCancelar: () => void
}

// Buscador/creador de lugares con deduplicación (spec §5.2): se busca contra
// nombre_normalizado y "Crear nueva" solo se habilita DESPUÉS de ver la
// lista de coincidencias. Al crear, el GPS se captura en silencio.
export function BuscadorLugar({ tipo, onElegir, onCancelar }: Props) {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<Lugar[]>([])
  const [buscado, setBuscado] = useState(false)
  const [creando, setCreando] = useState(false)
  const [municipio, setMunicipio] = useState('')
  const [contacto, setContacto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const etiqueta = tipo === 'PUNTO_VENTA' ? 'punto de venta' : 'taller'

  // Guardia de carrera: una respuesta vieja no debe pisar los resultados de
  // una consulta más nueva (el debounce no basta si la red desordena).
  const secuencia = useRef(0)

  // Búsqueda con debounce mientras el técnico escribe.
  useEffect(() => {
    if (consulta.trim().length < 2) {
      setResultados([])
      setBuscado(false)
      return
    }
    const t = window.setTimeout(async () => {
      const pedido = ++secuencia.current
      try {
        const { data } = await api.buscarLugares(tipo, consulta.trim())
        if (pedido !== secuencia.current) return
        setResultados(data)
        setBuscado(true)
      } catch {
        if (pedido !== secuencia.current) return
        setResultados([])
        setBuscado(true)
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [consulta, tipo])

  const crear = async () => {
    setGuardando(true)
    setError('')
    let gps: { lat: number; lng: number } | undefined
    try {
      const pos = await location.posicionActual()
      gps = { lat: pos.lat, lng: pos.lng }
    } catch {
      // GPS best-effort: se crea sin coordenadas si no hay fix.
    }
    try {
      const { lugar } = await api.crearLugar({
        tipo,
        nombre: consulta.trim(),
        municipio: municipio.trim() || undefined,
        contacto_nombre: contacto.trim() || undefined,
        contacto_telefono: telefono.trim() || undefined,
        lat: gps?.lat,
        lng: gps?.lng,
      })
      onElegir(lugar)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear el lugar')
      setGuardando(false)
    }
  }

  return (
    // Tocar el fondo cancela (una mano, sin estirar al botón ✕)
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-marino-900/70 sm:items-center"
      onClick={onCancelar}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-tinta">
            {tipo === 'PUNTO_VENTA' ? 'Punto de venta' : 'Taller externo'}
          </h2>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-tinta-2 ring-1 ring-borde"
            onClick={onCancelar}
          >
            ✕
          </button>
        </div>

        <input
          className="w-full rounded-xl border-2 border-cian bg-white p-3 text-lg text-tinta shadow-[0_2px_6px_rgba(18,181,201,.12)] placeholder:text-tinta-3 focus:outline-none"
          placeholder={`Nombre del ${etiqueta}…`}
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          autoFocus
          autoComplete="off"
        />

        {/* Coincidencias: reutilizar antes que duplicar */}
        {resultados.length > 0 && (
          <ul className="mt-3 space-y-2">
            {resultados.map((lugar) => (
              <li key={lugar.ROWID}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-borde bg-white p-3 text-left shadow-carta active:bg-cian-50"
                  onClick={() => onElegir(lugar)}
                >
                  <p className="font-semibold text-tinta">{lugar.nombre}</p>
                  {lugar.municipio && <p className="text-xs text-tinta-2">{lugar.municipio}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscado && !creando && (
          <button
            type="button"
            className="mt-3 h-12 w-full rounded-xl bg-cian-50 font-bold text-cian-600 ring-1 ring-cian/40 active:bg-cian-100"
            onClick={() => setCreando(true)}
          >
            + Crear «{consulta.trim()}» como {etiqueta} nuevo
          </button>
        )}

        {creando && (
          <div className="mt-3 space-y-2 rounded-xl bg-panel p-3 ring-1 ring-borde">
            <input
              className="w-full rounded-xl border border-borde bg-white p-3 text-tinta placeholder:text-tinta-3 focus:border-cian focus:outline-none"
              placeholder="Municipio (opcional)"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-borde bg-white p-3 text-tinta placeholder:text-tinta-3 focus:border-cian focus:outline-none"
              placeholder="Nombre del encargado (opcional)"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-borde bg-white p-3 text-tinta placeholder:text-tinta-3 focus:border-cian focus:outline-none"
              placeholder="Teléfono (opcional)"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
            {error && <p className="text-sm font-medium text-peligro-tx">{error}</p>}
            <button
              type="button"
              className="h-12 w-full rounded-xl bg-gradient-to-br from-cian to-cian-600 font-bold text-white shadow-cian active:opacity-90 disabled:opacity-40"
              disabled={guardando}
              onClick={() => void crear()}
            >
              {guardando ? 'Guardando…' : 'Guardar lugar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
