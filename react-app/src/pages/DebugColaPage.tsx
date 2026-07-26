import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { storage } from '../services'
import type { EventoEncolado } from '../services'

// Pantalla de depuración: lista cruda de la cola de eventos para verificar
// que el encolado funciona. No es parte del flujo del operador.
export default function DebugColaPage() {
  const [eventos, setEventos] = useState<EventoEncolado[]>([])

  useEffect(() => {
    let montado = true

    const cargar = () => {
      void storage.todos().then((lista) => {
        if (montado) {
          setEventos(lista)
        }
      })
    }

    cargar()
    const desuscribir = storage.suscribirCambios(cargar)

    return () => {
      montado = false
      desuscribir()
    }
  }, [])

  return (
    <main className="min-h-dvh bg-lienzo p-4 pt-16 text-tinta">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Cola de eventos</h1>
        <Link
          to="/"
          className="rounded-lg bg-marino px-4 py-3 font-bold text-white active:bg-marino-700"
        >
          ← Escanear
        </Link>
      </div>

      {eventos.length === 0 && (
        <p className="mt-8 text-center text-tinta-2">
          La cola está vacía. Escanea o teclea un número de serie.
        </p>
      )}

      <ul className="space-y-3">
        {eventos.map((evento) => (
          <li key={evento.uuid} className="rounded-carta border border-borde bg-white p-4 shadow-carta">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-cian-100 px-2 py-0.5 text-xs font-bold text-cian-600">
                {evento.tipo}
              </span>
              {evento.capturaManual ? (
                <span className="rounded bg-alerta-bg px-2 py-0.5 text-xs font-bold text-alerta-tx">
                  captura manual
                </span>
              ) : (
                <span className="rounded bg-panel px-2 py-0.5 text-xs font-bold text-tinta-2">
                  {evento.formatoCodigo ?? 'sin formato'}
                </span>
              )}
              {evento.sincronizado === 1 ? (
                <span className="rounded bg-exito-bg px-2 py-0.5 text-xs font-bold text-exito-tx">
                  sincronizado
                </span>
              ) : (
                <span className="rounded bg-peligro-bg px-2 py-0.5 text-xs font-bold text-peligro-tx">
                  pendiente
                </span>
              )}
            </div>
            <p className="font-mono text-lg break-all">{evento.numeroSerie}</p>
            <p className="mt-1 text-sm text-tinta-2">
              {new Date(evento.fechaEvento).toLocaleString('es-MX')}
              {evento.gps !== undefined &&
                ` · GPS ±${Math.round(evento.gps.precisionM)} m`}
            </p>
            <p className="mt-1 font-mono text-xs break-all text-tinta-3">{evento.uuid}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
