// El evento es la unidad que se encola y sincroniza. Nunca se guardan
// estados ("el equipo X ahora está En tránsito"); el estatus vigente se
// deriva reproduciendo los eventos en orden de fechaEvento.

export type TipoEvento =
  | 'ESCANEO_RECEPCION' // llega un equipo al almacén (Bloque 1)
  | 'ESCANEO_SALIDA' // sale del almacén bajo comodato (Bloque 2)
  | 'ESCANEO_PUNTO_CONTROL' // punto de control en tránsito, con GPS
  | 'ESCANEO_ENTREGA' // entrega en punto de venta
  | 'CAMBIO_ESTATUS' // cambio manual con motivo (diagnóstico, cuarentena, baja…)

export interface CoordenadasGps {
  lat: number
  lng: number
  precisionM: number
}

export interface Evento {
  // Generado en el cliente con crypto.randomUUID() al crear el evento.
  // Es la llave de idempotencia contra reintentos de red — nunca lo genera el servidor.
  uuid: string
  tipo: TipoEvento
  numeroSerie: string
  // TODO(auth): sin sesión todavía; el mockup usa 0. Aquí entrará el id del usuario autenticado.
  usuarioId: number
  // ISO 8601, reloj del dispositivo. Ordena la lógica de negocio.
  // fechaSincronizacion (reloj del servidor) existirá aparte y es solo auditoría.
  fechaEvento: string
  gps?: CoordenadasGps
  capturaManual: boolean
  // Solo mockup: formato que reportó el detector (code_128, qr_code, ean_13…).
  // Sirve para descubrir en bodega qué traen realmente las etiquetas de fábrica.
  formatoCodigo?: string
}
