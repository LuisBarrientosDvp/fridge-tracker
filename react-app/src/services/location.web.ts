import type { CoordenadasGps } from '../types/evento'
import type { LocationService } from './location'

// timeout corto a propósito: un escaneo no debe quedarse colgado esperando
// fix de GPS dentro de una bodega techada.
const TIMEOUT_MS = 5000
const EDAD_MAXIMA_MS = 60_000

export const locationWeb: LocationService = {
  posicionActual(): Promise<CoordenadasGps> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (posicion) => {
          resolve({
            lat: posicion.coords.latitude,
            lng: posicion.coords.longitude,
            precisionM: posicion.coords.accuracy,
          })
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: TIMEOUT_MS,
          maximumAge: EDAD_MAXIMA_MS,
        },
      )
    })
  },
}
