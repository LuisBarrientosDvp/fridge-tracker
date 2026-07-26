import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { SesionProvider, useSesion } from './context/SesionContext'
import { Cargando } from './components/ui'
import AlmacenPage from './pages/AlmacenPage'
import AltaEquipoPage from './pages/AltaEquipoPage'
import DebugColaPage from './pages/DebugColaPage'
import EscaneoPage from './pages/EscaneoPage'
import FichaEquipoPage from './pages/FichaEquipoPage'
import LoginPage from './pages/LoginPage'
import MenuPage from './pages/MenuPage'
import ReportesPage from './pages/ReportesPage'

// Compuerta de sesión: la PRIMERA pantalla de la app siempre es el login.
// Con sesión completa se montan las rutas; los roles limitan el menú y las
// rutas, y el backend vuelve a validar cada permiso (regla 7).
function Compuerta() {
  const { estado, usuario, cerrarSesion, recargar } = useSesion()

  if (estado === 'cargando') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950">
        <Cargando texto="Verificando sesión…" />
      </main>
    )
  }

  if (estado === 'sin-sesion' || estado === 'sin-sdk') {
    return <LoginPage />
  }

  if (estado === 'sin-registro' || !usuario) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="text-xl font-bold text-slate-100">Cuenta sin acceso</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Tu inicio de sesión es válido, pero esta cuenta todavía no está dada de alta en el
          sistema. Pide a un administrador que te registre y vuelve a intentar.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-200 ring-1 ring-slate-700"
            onClick={recargar}
          >
            Reintentar
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-200 ring-1 ring-slate-700"
            onClick={cerrarSesion}
          >
            Salir
          </button>
        </div>
      </main>
    )
  }

  const esAdmin = usuario.rol === 'ADMIN'
  const gestionaAlmacen = usuario.rol === 'ADMIN' || usuario.rol === 'ENCARGADO'

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/escanear" element={<EscaneoPage />} />
      <Route path="/equipos/:id" element={<FichaEquipoPage />} />
      <Route path="/alta" element={<AltaEquipoPage />} />
      <Route
        path="/almacen"
        element={gestionaAlmacen ? <AlmacenPage /> : <Navigate to="/menu" replace />}
      />
      <Route
        path="/reportes"
        element={esAdmin ? <ReportesPage /> : <Navigate to="/menu" replace />}
      />
      <Route path="/debug" element={<DebugColaPage />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  )
}

// HashRouter: el hosting de Catalyst sirve la app bajo /app/index.html sin
// rewrites de servidor; con BrowserRouter las rutas nunca coincidirían.
export default function App() {
  return (
    <SesionProvider>
      <HashRouter>
        <Compuerta />
      </HashRouter>
    </SesionProvider>
  )
}
