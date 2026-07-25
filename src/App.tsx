import { BrowserRouter, Route, Routes } from 'react-router'
import { ContadorPendientes } from './components/ContadorPendientes'
import EscaneoPage from './pages/EscaneoPage'

export default function App() {
  return (
    <BrowserRouter>
      {/* Fuera de <Routes> para que el contador se vea en todas las pantallas */}
      <ContadorPendientes />
      <Routes>
        <Route path="/" element={<EscaneoPage />} />
      </Routes>
    </BrowserRouter>
  )
}
