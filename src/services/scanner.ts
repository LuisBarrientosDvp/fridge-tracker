// Interfaz del servicio de escaneo. La app solo conoce esta forma;
// la implementación concreta la elige src/services/index.ts.
//
// Nota de diseño: CLAUDE.md boceta escanear(): Promise<string>, pero la
// pantalla de escaneo es continua (la cámara queda abierta y cada código
// detectado dispara un evento), así que la interfaz es de sesión.

export interface LecturaCodigo {
  // Cadena decodificada tal cual la reporta el detector, sin limpiar.
  // El mockup la muestra cruda para descubrir qué traen las etiquetas reales.
  valorCrudo: string
  // Formato detectado: code_128, ean_13, qr_code, etc.
  formato: string
}

export interface SesionEscaneo {
  // Solo web: stream de la cámara para que la pantalla muestre el preview.
  // En nativo (ML Kit) el plugin dibuja su propia UI y esto vendrá undefined.
  stream?: MediaStream
  detener(): void
}

export interface ScannerService {
  // false cuando la API de detección no existe (Safari/iOS: ningún navegador
  // de iOS implementa BarcodeDetector — todos usan WebKit). La pantalla debe
  // degradar a captura manual.
  estaDisponible(): Promise<boolean>
  iniciar(alDetectar: (lectura: LecturaCodigo) => void): Promise<SesionEscaneo>
}
