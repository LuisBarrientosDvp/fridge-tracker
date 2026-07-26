import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Cabecera } from '../components/ui'
import { useSesion } from '../context/SesionContext'
import { api, location } from '../services'
import type { Almacen, CatalogoItem } from '../types/api'

// Alta en campo (spec §7, 404 del escaneo): serial (o "sin serial"), marca y
// tipo obligatorios; el resto opcional. El código escaneado llega precargado
// en serial y es editable. Estatus inicial: EN_ALMACEN + OPERATIVO (backend).
export default function AltaEquipoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { usuario } = useSesion()

  const [serial, setSerial] = useState(params.get('codigo') ?? '')
  const [sinSerial, setSinSerial] = useState(false)
  const [numActivo, setNumActivo] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [tipo, setTipo] = useState('')
  const [anio, setAnio] = useState('')
  const [cerveza, setCerveza] = useState('')
  const [almacenId, setAlmacenId] = useState('')

  const [marcas, setMarcas] = useState<CatalogoItem[]>([])
  const [tipos, setTipos] = useState<CatalogoItem[]>([])
  const [cervezas, setCervezas] = useState<CatalogoItem[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api.catalogo('MARCA').then((r) => setMarcas(r.data)).catch(() => undefined)
    void api.catalogo('EQUIPO_TIPO').then((r) => setTipos(r.data)).catch(() => undefined)
    void api.catalogo('CERVEZA').then((r) => setCervezas(r.data)).catch(() => undefined)
    void api.almacenes().then((r) => setAlmacenes(r.data)).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (usuario?.almacen_id) setAlmacenId(usuario.almacen_id)
  }, [usuario])

  const puedeGuardar = marca !== '' && tipo !== '' && (sinSerial || serial.trim() !== '') && almacenId !== ''

  const guardar = async () => {
    setGuardando(true)
    setError('')
    let gps: { lat: number; lng: number } | undefined
    try {
      const pos = await location.posicionActual()
      gps = { lat: pos.lat, lng: pos.lng }
    } catch {
      gps = undefined
    }
    try {
      const { equipo } = await api.crearEquipo({
        serial: sinSerial ? undefined : serial.trim(),
        num_activo: numActivo.trim() || undefined,
        marca,
        modelo: modelo.trim() || undefined,
        equipo_tipo: tipo,
        anio: anio ? Number(anio) : undefined,
        cerveza: cerveza || undefined,
        almacen_id: almacenId,
        formato_codigo: params.get('formato') || undefined,
        uuid_cliente: crypto.randomUUID(),
        lat: gps?.lat,
        lng: gps?.lng,
      })
      navigate(`/equipos/${equipo.ROWID}`, { replace: true })
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo dar de alta')
      setGuardando(false)
    }
  }

  const campo =
    'w-full rounded-xl border border-borde bg-white p-3 text-tinta shadow-carta placeholder:text-tinta-3 focus:border-cian focus:outline-none disabled:bg-panel'

  return (
    <main className="min-h-dvh bg-lienzo pb-16">
      <Cabecera titulo="Alta de equipo en campo" subtitulo="Quedará EN ALMACÉN · OPERATIVO" volverA="/escanear" />

      <form
        className="mx-auto max-w-xl space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (puedeGuardar && !guardando) void guardar()
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-tinta-2">Serial (placa)</label>
          <input
            className={`${campo} font-mono ${sinSerial ? 'opacity-40' : ''}`}
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            disabled={sinSerial}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="Serial de la placa"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-tinta-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-cian-600"
              checked={sinSerial}
              onChange={(e) => setSinSerial(e.target.checked)}
            />
            Sin serial legible (se le asignará un QR después)
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">Marca *</label>
            <select className={campo} value={marca} onChange={(e) => setMarca(e.target.value)}>
              <option value="">Elegir marca…</option>
              {marcas.map((m) => (
                <option key={m.ROWID} value={m.valor}>
                  {m.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">Tipo de equipo *</label>
            <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Elegir tipo…</option>
              {tipos.map((t) => (
                <option key={t.ROWID} value={t.valor}>
                  {t.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">Modelo</label>
            <input
              className={campo}
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              autoComplete="off"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">Año</label>
            <input
              className={campo}
              value={anio}
              onChange={(e) => setAnio(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">Cerveza / marca publicitaria</label>
            <select className={campo} value={cerveza} onChange={(e) => setCerveza(e.target.value)}>
              <option value="">Opcional…</option>
              {cervezas.map((c) => (
                <option key={c.ROWID} value={c.valor}>
                  {c.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta-2">No. de activo</label>
            <input
              className={`${campo} font-mono`}
              value={numActivo}
              onChange={(e) => setNumActivo(e.target.value)}
              autoComplete="off"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-tinta-2">Almacén *</label>
          <select className={campo} value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
            <option value="">Elegir almacén…</option>
            {almacenes.map((a) => (
              <option key={a.ROWID} value={a.ROWID}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-xl bg-peligro-bg px-3 py-2 text-sm font-medium text-peligro-tx">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="h-16 w-full rounded-2xl bg-gradient-to-br from-cian to-cian-600 text-lg font-bold text-white shadow-cian active:opacity-90 disabled:opacity-40"
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando…' : 'Registrar equipo'}
        </button>
      </form>
    </main>
  )
}
