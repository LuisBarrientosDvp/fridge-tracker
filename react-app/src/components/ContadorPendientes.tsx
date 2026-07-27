import { Link } from 'react-router'
import { usePendientes } from '../hooks/usePendientes'

// Contador de eventos por sincronizar (regla 6 de CLAUDE.md): montado en
// App para que sea visible en TODAS las pantallas mientras haya cola.
// Con la cola vacía no pinta nada — la cola Dexie es legado y solo /debug
// la alimenta hoy. Tocándolo se llega a la pantalla de depuración.
export function ContadorPendientes() {
  const pendientes = usePendientes()

  if (pendientes === 0) return null

  return (
    <Link
      to="/debug"
      className="fixed right-3 top-3 z-50 rounded-full bg-alerta-dot px-4 py-2 text-sm font-bold text-white shadow-lg"
    >
      {pendientes} por sincronizar
    </Link>
  )
}
