import type { Estatus } from './estatus'

// Ficha del equipo. El número de serie es la llave única de todo el sistema.
// En el mockup vive solo en Dexie; después será la copia local del inventario
// del almacén asignado al usuario, para abrir fichas escaneando sin señal (regla 7).
export interface Refrigerador {
  numeroSerie: string
  marca?: string
  modelo?: string
  // estatusVigente es un derivado cacheado de los eventos, nunca la fuente de verdad.
  estatusVigente: Estatus
  ubicacionInterna?: string
  // TODO(backend): almacenId referirá al catálogo de almacenes cuando exista.
  almacenId?: number
}
