import { ListaEquipos } from '../components/ListaEquipos'
import { Cabecera } from '../components/ui'

// Reportes globales — solo ADMIN (la ruta está protegida en App.tsx).
export default function ReportesPage() {
  return (
    <main className="min-h-dvh bg-lienzo pb-16">
      <Cabecera titulo="Reportes" subtitulo="Inventario global · todos los almacenes" />
      <div className="mx-auto max-w-5xl p-4">
        <ListaEquipos conAlmacenes conTotales />
      </div>
    </main>
  )
}
