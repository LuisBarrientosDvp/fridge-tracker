import { Link } from 'react-router'
import { useSesion } from '../context/SesionContext'

const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: 'Superadmin',
  ENCARGADO: 'Encargado de almacén',
  TECNICO: 'Técnico',
}

interface Opcion {
  a: string
  emoji: string
  titulo: string
  descripcion: string
  acento: string
}

// Menú principal según rol (spec §9):
//   ADMIN     → reportes globales + escanear + almacén
//   ENCARGADO → escanear + administrar su almacén
//   TECNICO   → solo escanear
export default function MenuPage() {
  const { usuario, cerrarSesion } = useSesion()
  if (!usuario) return null

  const opciones: Opcion[] = [
    {
      a: '/escanear',
      emoji: '📷',
      titulo: 'Escanear equipo',
      descripcion: 'Lee el código de barras o QR y abre la ficha',
      acento: 'from-emerald-500/20 to-emerald-500/5 ring-emerald-500/30',
    },
  ]
  if (usuario.rol === 'ENCARGADO' || usuario.rol === 'ADMIN') {
    opciones.push({
      a: '/almacen',
      emoji: '🏬',
      titulo: 'Mi almacén',
      descripcion: 'Inventario y estatus de los equipos del almacén',
      acento: 'from-sky-500/20 to-sky-500/5 ring-sky-500/30',
    })
  }
  if (usuario.rol === 'ADMIN') {
    opciones.push({
      a: '/reportes',
      emoji: '📊',
      titulo: 'Reportes',
      descripcion: 'Inventario global, filtros y totales por estatus',
      acento: 'from-violet-500/20 to-violet-500/5 ring-violet-500/30',
    })
  }

  return (
    <main className="min-h-dvh bg-slate-950 pb-10">
      {/* Cabecera con identidad y usuario */}
      <header className="bg-gradient-to-b from-slate-900 to-slate-950 px-4 pb-6 pt-8">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-2xl">
            ❄️
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-slate-100">Fridge Tracker</h1>
            <p className="truncate text-sm text-slate-400">
              {usuario.nombre} · {ETIQUETA_ROL[usuario.rol] ?? usuario.rol}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 ring-1 ring-slate-700 active:bg-slate-700"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Opciones del menú */}
      <div className="mx-auto max-w-2xl space-y-3 px-4">
        {opciones.map((op) => (
          <Link
            key={op.a}
            to={op.a}
            className={`flex items-center gap-4 rounded-2xl bg-gradient-to-br p-5 ring-1 active:scale-[0.99] ${op.acento}`}
          >
            <span className="text-4xl">{op.emoji}</span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-slate-100">{op.titulo}</span>
              <span className="block text-sm text-slate-400">{op.descripcion}</span>
            </span>
            <span className="ml-auto text-2xl text-slate-500">›</span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-slate-700">
        <Link to="/debug" className="underline decoration-slate-800">
          cola local
        </Link>
      </p>
    </main>
  )
}
