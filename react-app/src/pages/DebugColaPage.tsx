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
    <main className="min-h-dvh bg-slate-900 p-4 pt-16 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Cola de eventos</h1>
        <Link
          to="/"
          className="rounded-lg bg-slate-100 px-4 py-3 font-bold text-slate-900 active:bg-slate-300"
        >
          ← Escanear
        </Link>
      </div>

      {eventos.length === 0 && (
        <p className="mt-8 text-center text-slate-400">
          La cola está vacía. Escanea o teclea un número de serie.
        </p>
      )}

      <ul className="space-y-3">
        {eventos.map((evento) => (
          <li key={evento.uuid} className="rounded-xl bg-slate-800 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">
                {evento.tipo}
              </span>
              {evento.capturaManual ? (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                  captura manual
                </span>
              ) : (
                <span className="rounded bg-slate-600/50 px-2 py-0.5 text-xs font-bold text-slate-300">
                  {evento.formatoCodigo ?? 'sin formato'}
                </span>
              )}
              {evento.sincronizado === 1 ? (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  sincronizado
                </span>
              ) : (
                <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                  pendiente
                </span>
              )}
            </div>
            <p className="font-mono text-lg break-all">{evento.numeroSerie}</p>
            <p className="mt-1 text-sm text-slate-400">
              {new Date(evento.fechaEvento).toLocaleString('es-MX')}
              {evento.gps !== undefined &&
                ` · GPS ±${Math.round(evento.gps.precisionM)} m`}
            </p>
            <p className="mt-1 font-mono text-xs break-all text-slate-500">{evento.uuid}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
