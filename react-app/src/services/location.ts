import type { CoordenadasGps } from '../types/evento'

// Interfaz del servicio de geolocalización. Reusa CoordenadasGps del
// dominio: lo que devuelve es exactamente lo que se guarda en el evento.

export interface LocationService {
  // Rechaza si el usuario niega el permiso o si no hay fix a tiempo.
  // Quien la llame decide si el GPS es obligatorio u opcional para su flujo.
  posicionActual(): Promise<CoordenadasGps>
}
