import { HashRouter, Route, Routes } from 'react-router'
import { ContadorPendientes } from './components/ContadorPendientes'
import DebugColaPage from './pages/DebugColaPage'
import EscaneoPage from './pages/EscaneoPage'

// HashRouter: el hosting de Catalyst sirve la app bajo /app/index.html sin
// rewrites de servidor; con BrowserRouter las rutas "/" y "/debug" nunca
// coincidirían con esa URL.
export default function App() {
  return (
    <HashRouter>
      {/* Fuera de <Routes> para que el contador se vea en todas las pantallas */}
      <ContadorPendientes />
      <Routes>
        <Route path="/" element={<EscaneoPage />} />
        <Route path="/debug" element={<DebugColaPage />} />
      </Routes>
    </HashRouter>
  )
}
