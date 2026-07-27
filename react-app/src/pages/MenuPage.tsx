import { Link } from 'react-router'
import { useSesion } from '../context/SesionContext'
import { EtiquetaDispositivo, LogoCopo } from '../components/ui'

const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: 'Superadmin',
  ENCARGADO: 'Encargado de almacén',
  TECNICO: 'Técnico',
}

interface Opcion {
  a: string
  titulo: string
  descripcion: string
  icono: React.ReactNode
}

function Icono({ d }: { d: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

// Menú principal según rol (spec §9):
//   ADMIN     → reportes globales + usuarios + escanear + almacén
//   ENCARGADO → escanear + administrar su almacén
//   TECNICO   → solo escanear
export default function MenuPage() {
  const { usuario, cerrarSesion } = useSesion()
  if (!usuario) return null

  const iniciales = usuario.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const opciones: Opcion[] = []
  if (usuario.rol === 'ENCARGADO' || usuario.rol === 'ADMIN') {
    opciones.push({
      a: '/almacen',
      titulo: 'Mi almacén',
      descripcion: 'Inventario y estatus de los equipos del almacén',
      icono: <Icono d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2 M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    })
  }
  if (usuario.rol === 'ADMIN') {
    opciones.push({
      a: '/reportes',
      titulo: 'Reportes',
      descripcion: 'Inventario global, filtros y totales por estatus',
      icono: <Icono d="M3 3v18h18 M19 9l-5 5-4-4-3 3" />,
    })
    opciones.push({
      a: '/usuarios',
      titulo: 'Usuarios',
      descripcion: 'Invitar por correo y asignar roles y almacenes',
      icono: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    })
  }

  return (
    <main className="min-h-dvh bg-lienzo pb-10">
      {/* Barra de app marina del design system */}
      <header className="bg-marino px-4 pb-6 pt-5 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <LogoCopo tamano={28} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-none">Fridge Tracker</h1>
              <EtiquetaDispositivo />
            </div>
            <p className="mt-1 truncate text-sm text-marino-300">
              {usuario.nombre} · {ETIQUETA_ROL[usuario.rol] ?? usuario.rol}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marino-700 text-sm font-bold text-cian-300">
            {iniciales || '?'}
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="shrink-0 whitespace-nowrap rounded-lg bg-marino-700/60 px-3 py-2 text-sm font-medium text-white active:bg-marino-700"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-5">
        {/* Botón grande de escaneo (pantalla 1 del design) */}
        <Link
          to="/escanear"
          className="flex w-full items-center gap-4 rounded-[20px] bg-gradient-to-br from-cian to-cian-600 p-6 text-white shadow-cian active:opacity-90"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
            </svg>
          </span>
          <span className="text-left">
            <span className="block text-xl font-bold leading-none">Escanear equipo</span>
            <span className="mt-1.5 block text-sm text-cian-100">QR o código de barras</span>
          </span>
          <span className="ml-auto text-2xl text-white/60">›</span>
        </Link>

        {/* Resto del menú: tarjetas blancas */}
        {opciones.map((op) => (
          <Link
            key={op.a}
            to={op.a}
            className="flex items-center gap-4 rounded-carta border border-borde bg-white p-5 shadow-carta active:bg-cian-50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cian-50 text-cian-600">
              {op.icono}
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-tinta">{op.titulo}</span>
              <span className="block text-sm text-tinta-2">{op.descripcion}</span>
            </span>
            <span className="ml-auto text-2xl text-tinta-3">›</span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-tinta-3">
        <Link to="/debug" className="underline decoration-borde">
          cola local
        </Link>
      </p>
    </main>
  )
}
