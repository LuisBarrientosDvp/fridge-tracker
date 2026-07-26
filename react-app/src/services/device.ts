// Tipo de dispositivo para mostrar en la cabecera (y útil para depurar
// reportes de campo: saber desde qué tipo de equipo se usó la app).

export type TipoDispositivo = 'PC' | 'Android' | 'iOS' | 'Móvil'

export interface DeviceService {
  tipo(): TipoDispositivo
}
