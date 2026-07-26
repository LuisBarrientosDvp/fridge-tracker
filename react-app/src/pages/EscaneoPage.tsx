import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CapturaManual } from '../components/CapturaManual'
import { api, ApiError, haptics, scanner } from '../services'
import type { SesionEscaneo } from '../services'

type EstadoEscaner =
  | 'iniciando'
  | 'escaneando'
  | 'consultando' // código leído, resolviendo contra el backend
  | 'sin-camara' // getUserMedia no disponible o permiso negado
  | 'no-encontrado' // 404: ofrecer alta en campo

interface Lectura {
  valor: string
  formato?: string
  manual: boolean
}

// Esquina del recuadro de encuadre (design system: brackets cian).
function Esquina({ pos }: { pos: string }) {
  return <div className={`absolute h-11 w-11 border-cian ${pos}`} />
}

// Pantalla de escaneo conectada (spec §7): leer código → GET /codigos/:codigo
// → 200 abre la ficha · 404 ofrece el alta con el código precargado.
// Tema oscuro del design (pantalla 2): fondo #101820, acentos cian.
export default function EscaneoPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const ocupado = useRef(false)
  const [estado, setEstado] = useState<EstadoEscaner>('iniciando')
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [flash, setFlash] = useState(false)
  const [capturaAbierta, setCapturaAbierta] = useState(false)
  const [error, setError] = useState('')

  const resolver = async (valor: string, formato: string | undefined, manual: boolean) => {
    if (ocupado.current) return
    ocupado.current = true
    haptics.vibrar(150)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 350)
    setLectura({ valor, formato, manual })
    setEstado('consultando')
    setError('')
    try {
      const { equipo } = await api.resolverCodigo(valor)
      navigate(`/equipos/${equipo.ROWID}`)
      return
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setEstado('no-encontrado')
      } else {
        setError(err instanceof Error ? err.message : 'Error de red')
        setEstado('escaneando')
      }
    } finally {
      ocupado.current = false
    }
  }

  useEffect(() => {
    let cancelado = false
    let sesion: SesionEscaneo | null = null

    const arrancar = async () => {
      if (!(await scanner.estaDisponible())) {
        setEstado('sin-camara')
        setCapturaAbierta(true)
        return
      }
      try {
        sesion = await scanner.iniciar((l) => {
          void resolver(l.valorCrudo, l.formato, false)
        })
      } catch {
        setEstado('sin-camara')
        setCapturaAbierta(true)
        return
      }
      if (cancelado) {
        sesion.detener()
        return
      }
      if (videoRef.current !== null && sesion.stream !== undefined) {
        videoRef.current.srcObject = sesion.stream
      }
      setEstado('escaneando')
    }

    void arrancar()
    return () => {
      cancelado = true
      sesion?.detener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="relative min-h-dvh bg-oscuro text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {flash && <div className="absolute inset-0 z-20 bg-cian/40" />}

      {/* Cabecera sobre el video */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-oscuro/90 to-transparent p-4 pb-12">
        <div className="flex items-center gap-3">
          <Link
            to="/menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oscuro-800/90 text-xl"
            aria-label="Volver al menú"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-bold">Escanear equipo</h1>
            <p className="text-sm text-oscuro-tx">
              {estado === 'iniciando' && 'Abriendo cámara…'}
              {estado === 'escaneando' && 'Alinea el código dentro del recuadro'}
              {estado === 'consultando' && 'Buscando el equipo…'}
              {estado === 'sin-camara' && 'Sin cámara: captura el código a mano'}
              {estado === 'no-encontrado' && 'Código sin registrar'}
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-2 rounded-lg bg-peligro-bg px-3 py-2 text-sm font-medium text-peligro-tx">
            {error}
          </p>
        )}
      </div>

      {/* Guía de encuadre: brackets cian del design */}
      {estado === 'escaneando' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-52 w-72 max-w-[85vw] shadow-[0_0_0_9999px_rgba(16,24,32,0.45)]">
            <Esquina pos="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
            <Esquina pos="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
            <Esquina pos="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
            <Esquina pos="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
            <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cian-300 to-transparent" />
          </div>
        </div>
      )}

      {/* 404 → alta en campo con el código precargado */}
      {estado === 'no-encontrado' && lectura && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-oscuro/95 p-5 pb-8">
          <div className="mx-auto max-w-md">
            <p className="mb-1 text-sm text-oscuro-tx">Este código no está en el sistema:</p>
            <p className="mb-4 break-all font-mono text-xl">{lectura.valor}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="h-14 flex-1 rounded-2xl bg-gradient-to-br from-cian to-cian-600 text-lg font-bold text-white shadow-cian active:opacity-90"
                onClick={() =>
                  navigate(
                    `/alta?codigo=${encodeURIComponent(lectura.valor)}&formato=${encodeURIComponent(lectura.formato ?? '')}`,
                  )
                }
              >
                ＋ Dar de alta este equipo
              </button>
              <button
                type="button"
                className="h-14 flex-1 rounded-2xl bg-oscuro-800 text-lg font-bold text-white active:bg-oscuro-800/70"
                onClick={() => {
                  setLectura(null)
                  setEstado('escaneando')
                }}
              >
                Seguir escaneando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel inferior: última lectura + captura manual (regla 5) */}
      {estado !== 'no-encontrado' && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-oscuro/95 to-transparent p-4 pt-12">
          <div className="mx-auto max-w-md">
            {lectura !== null && estado === 'consultando' && (
              <div className="mb-3 rounded-xl bg-oscuro-800/95 p-4">
                <span className="rounded bg-cian/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-cian-300">
                  {lectura.formato ?? 'manual'}
                </span>
                <p className="mt-1 break-all font-mono text-xl">{lectura.valor}</p>
              </div>
            )}
            <button
              type="button"
              className="h-14 w-full rounded-full bg-oscuro-800 text-base font-medium text-white active:bg-oscuro-800/70"
              onClick={() => setCapturaAbierta(true)}
            >
              ⌨ Teclear código a mano
            </button>
          </div>
        </div>
      )}

      <CapturaManual
        abierta={capturaAbierta}
        onConfirmar={(valor) => {
          setCapturaAbierta(false)
          void resolver(valor, undefined, true)
        }}
        onCerrar={() => setCapturaAbierta(false)}
      />
    </main>
  )
}
