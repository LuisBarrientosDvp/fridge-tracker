import type { CameraService } from './camera'

// TODO(fotos): implementar cuando entre el flujo de diagnóstico.
// En web: getUserMedia → capturar frame a canvas → redimensionar a ~1200px
// de lado largo → toBlob('image/jpeg', 0.7). La compresión ocurre AQUÍ,
// antes de encolar (regla 6). Las fotos van a una cola aparte de menor
// prioridad que los eventos, no a la cola de SyncQueue.
export const cameraWeb: CameraService = {
  async tomarFoto(): Promise<Blob> {
    throw new Error('camera.web.ts: tomarFoto() no implementado en el mockup v1')
  },
}
