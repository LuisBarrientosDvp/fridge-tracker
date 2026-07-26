import { useEffect, useState } from 'react'
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
import UsuariosPage from './pages/UsuariosPage'

const BOTON_SECUNDARIO =
  'rounded-xl bg-white px-4 py-2.5 font-semibold text-tinta shadow-carta ring-1 ring-borde active:bg-panel'

// Verificación de sesión con salida de emergencia: si tarda demasiado (SDK
// colgado en un dispositivo sin sesión), aparece "Cerrar sesión" para no
// dejar al usuario atrapado en esta pantalla.
function PantallaVerificando({ cerrarSesion }: { cerrarSesion: () => void }) {
  const [tardando, setTardando] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setTardando(true), 8000)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-lienzo">
      <Cargando texto="Verificando sesión…" />
      {tardando && (
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <p className="max-w-xs text-sm text-tinta-2">
            Esto está tardando más de lo normal. Puedes cerrar la sesión y volver a entrar.
          </p>
          <button type="button" className={BOTON_SECUNDARIO} onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      )}
    </main>
  )
}

function PantallaAviso({
  emoji,
  titulo,
  texto,
  recargar,
  cerrarSesion,
}: {
  emoji: string
  titulo: string
  texto: string
  recargar: () => void
  cerrarSesion: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-lienzo px-6 text-center">
      <span className="text-5xl">{emoji}</span>
      <h1 className="text-xl font-bold text-tinta">{titulo}</h1>
      <p className="max-w-sm text-sm text-tinta-2">{texto}</p>
      <div className="flex gap-3">
        <button type="button" className={BOTON_SECUNDARIO} onClick={recargar}>
          Reintentar
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}

// Compuerta de sesión: la PRIMERA pantalla de la app siempre es el login.
// Con sesión completa se montan las rutas; los roles limitan el menú y las
// rutas, y el backend vuelve a validar cada permiso (regla 8).
function Compuerta() {
  const { estado, usuario, cerrarSesion, recargar } = useSesion()

  if (estado === 'cargando') {
    return <PantallaVerificando cerrarSesion={cerrarSesion} />
  }

  if (estado === 'sin-sesion' || estado === 'sin-sdk') {
    return <LoginPage />
  }

  // Sesión de Catalyst válida pero el backend la rechaza (401): mostrar el
  // error en vez del login — reenviar al login hospedado causaría un bucle.
  if (estado === 'error-auth') {
    return (
      <PantallaAviso
        emoji="⚠️"
        titulo="Sesión no reconocida por el servidor"
        texto="Tu inicio de sesión de Catalyst es válido, pero el servidor no aceptó las credenciales. Suele resolverse reintentando; si persiste, cierra sesión y vuelve a entrar."
        recargar={recargar}
        cerrarSesion={cerrarSesion}
      />
    )
  }

  if (estado === 'sin-registro' || !usuario) {
    return (
      <PantallaAviso
        emoji="🔒"
        titulo="Cuenta sin acceso"
        texto="Tu inicio de sesión es válido, pero esta cuenta todavía no está dada de alta en el sistema. Pide a un administrador que te registre y vuelve a intentar."
        recargar={recargar}
        cerrarSesion={cerrarSesion}
      />
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
      <Route
        path="/usuarios"
        element={esAdmin ? <UsuariosPage /> : <Navigate to="/menu" replace />}
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
