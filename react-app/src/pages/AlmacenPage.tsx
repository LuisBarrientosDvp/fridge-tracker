import { ListaEquipos } from '../components/ListaEquipos'
import { Cabecera } from '../components/ui'
import { useSesion } from '../context/SesionContext'

// "Mi almacén" — ENCARGADO y ADMIN. El encargado ve su almacén base; un
// admin sin almacén asignado ve el selector completo.
export default function AlmacenPage() {
  const { usuario } = useSesion()
  const almacenFijo = usuario?.almacen_id ?? undefined

  return (
    <main className="min-h-dvh bg-slate-950 pb-16">
      <Cabecera titulo="Mi almacén" subtitulo="Inventario y estatus de los equipos" />
      <div className="mx-auto max-w-5xl p-4">
        <ListaEquipos almacenFijo={almacenFijo} conAlmacenes={!almacenFijo} conTotales />
      </div>
    </main>
  )
}
