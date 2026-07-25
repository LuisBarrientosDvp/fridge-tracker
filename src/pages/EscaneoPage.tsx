import { useEffect, useRef, useState } from 'react'
import { CapturaManual } from '../components/CapturaManual'
import { haptics, location, scanner, storage } from '../services'
import type { SesionEscaneo } from '../services'
import type { Evento } from '../types/evento'

// TODO(auth): sin sesión en el mockup; todos los eventos llevan usuario 0.
const USUARIO_MOCKUP = 0

type EstadoEscaner =
  | 'iniciando'
  | 'escaneando'
  | 'sin-detector' // BarcodeDetector no existe (todo iOS, ver gotchas de CLAUDE.md)
  | 'error-camara' // permiso negado u otra falla de getUserMedia

interface UltimaLectura {
  valorCrudo: string
  formato: string
  capturaManual: boolean
}

export default function EscaneoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<EstadoEscaner>('iniciando')
  const [ultimaLectura, setUltimaLectura] = useState<UltimaLectura | null>(null)
  const [flashActivo, setFlashActivo] = useState(false)
  const [capturaAbierta, setCapturaAbierta] = useState(false)

  // Registra una lectura venga de donde venga (detector o teclado):
  // feedback inmediato y el evento a la cola.
  const registrarLectura = async (
    valorCrudo: string,
    formato: string | undefined,
    capturaManual: boolean,
  ) => {
    haptics.vibrar(150)
    setUltimaLectura({ valorCrudo, formato: formato ?? 'captura manual', capturaManual })
    setFlashActivo(true)
    window.setTimeout(() => setFlashActivo(false), 400)

    // GPS best-effort: si no hay fix en 5 s (normal dentro de una bodega
    // techada) el evento se encola sin gps. La espera no bloquea el feedback
    // de arriba, solo retrasa el encolado unos segundos como máximo.
    let gps: Evento['gps']
    try {
      gps = await location.posicionActual()
    } catch {
      gps = undefined
    }

    const evento: Evento = {
      uuid: crypto.randomUUID(),
      tipo: 'ESCANEO_RECEPCION',
      numeroSerie: valorCrudo,
      usuarioId: USUARIO_MOCKUP,
      fechaEvento: new Date().toISOString(),
      gps,
      capturaManual,
      formatoCodigo: formato,
    }
    await storage.encolar(evento)
  }

  useEffect(() => {
    let cancelado = false
    let sesion: SesionEscaneo | null = null

    const arrancar = async () => {
      const disponible = await scanner.estaDisponible()
      if (cancelado) {
        return
      }
      if (!disponible) {
        // Sin detector la única vía es el teclado; se abre de una vez.
        setEstado('sin-detector')
        setCapturaAbierta(true)
        return
      }
      try {
        sesion = await scanner.iniciar((lectura) => {
          void registrarLectura(lectura.valorCrudo, lectura.formato, false)
        })
      } catch {
        setEstado('error-camara')
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
    // registrarLectura solo usa setters y servicios; no necesita ser dependencia.
  }, [])

  return (
    <main className="relative min-h-dvh bg-slate-900 text-slate-100">
      {/* Preview de cámara a pantalla completa */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {/* Flash verde al detectar — feedback visual además de la vibración */}
      {flashActivo && <div className="absolute inset-0 z-20 bg-emerald-400/40" />}

      {/* Encabezado */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-slate-950/90 to-transparent p-4 pb-10">
        <h1 className="text-lg font-bold">Escaneo · Recepción</h1>
        <p className="text-sm text-slate-300">
          {estado === 'iniciando' && 'Abriendo cámara…'}
          {estado === 'escaneando' && 'Apunta al código de barras de fábrica'}
          {estado === 'sin-detector' && 'Este navegador no puede escanear códigos'}
          {estado === 'error-camara' && 'No se pudo abrir la cámara'}
        </p>
      </div>

      {/* Guía de encuadre */}
      {estado === 'escaneando' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-72 max-w-[85vw] rounded-xl border-4 border-white/70" />
        </div>
      )}

      {/* Mensajes de los estados sin cámara */}
      {estado === 'sin-detector' && (
        <div className="absolute inset-x-0 top-1/4 z-10 px-6 text-center">
          <p className="text-base text-slate-200">
            Este navegador no trae la API de detección de códigos (pasa en todos los navegadores
            de iPhone/iPad). Registra el número de serie a mano.
          </p>
        </div>
      )}
      {estado === 'error-camara' && (
        <div className="absolute inset-x-0 top-1/4 z-10 px-6 text-center">
          <p className="text-base text-slate-200">
            Revisa que el navegador tenga permiso de cámara y que ninguna otra app la esté usando.
            Mientras tanto puedes registrar el número de serie a mano.
          </p>
        </div>
      )}

      {/* Panel inferior: última lectura + captura manual siempre disponible */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/95 to-transparent p-4 pt-12">
        {ultimaLectura !== null && (
          <div className="mb-3 rounded-xl bg-slate-800/95 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-bold tracking-wide text-sky-300 uppercase">
                {ultimaLectura.formato}
              </span>
              <span className="text-xs text-emerald-400">✓ evento encolado</span>
            </div>
            {/* Cadena cruda a propósito: sirve para descubrir en bodega qué
                traen las etiquetas (¿serie?, ¿modelo?, ¿UPC?) */}
            <p className="font-mono text-xl break-all text-slate-100">{ultimaLectura.valorCrudo}</p>
          </div>
        )}

        <button
          type="button"
          className="h-16 w-full rounded-xl bg-slate-100 text-lg font-bold text-slate-900 active:bg-slate-300"
          onClick={() => setCapturaAbierta(true)}
        >
          ⌨ Teclear número de serie
        </button>
      </div>

      <CapturaManual
        abierta={capturaAbierta}
        onConfirmar={(numeroSerie) => {
          void registrarLectura(numeroSerie, undefined, true)
          // Sin detector no hay cámara detrás: el panel se queda abierto
          // para seguir capturando series una tras otra.
          if (estado !== 'sin-detector') {
            setCapturaAbierta(false)
          }
        }}
        onCerrar={estado === 'sin-detector' ? undefined : () => setCapturaAbierta(false)}
      />
    </main>
  )
}
