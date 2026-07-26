// Interfaz del servicio de cámara para fotos de diagnóstico.
// Las fotos están fuera del alcance del mockup v1; la interfaz existe
// para que la estructura de servicios quede completa desde el inicio.

export interface CameraService {
  // Debe devolver la foto YA comprimida (regla 6 de CLAUDE.md):
  // canvas a ~1200px de lado largo, JPEG calidad 0.7 → ~150-250 KB.
  tomarFoto(): Promise<Blob>
}
