import { usePendientes } from '../hooks/usePendientes'

// Contador de eventos por sincronizar. Va montado en App para que sea
// visible en TODAS las pantallas (regla 8 de CLAUDE.md).
export function ContadorPendientes() {
  const pendientes = usePendientes()

  return (
    <div
      className={`fixed top-3 right-3 z-50 rounded-full px-4 py-2 text-sm font-bold shadow-lg ${
        pendientes > 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-700 text-slate-300'
      }`}
    >
      {pendientes} por sincronizar
    </div>
  )
}
