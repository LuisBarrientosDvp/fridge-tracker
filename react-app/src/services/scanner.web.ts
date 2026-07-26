import type { LecturaCodigo, ScannerService, SesionEscaneo } from './scanner'

const INTERVALO_DETECCION_MS = 200
// El detector reporta el mismo código en cada frame mientras la etiqueta
// siga frente a la cámara; sin esta ventana se encolarían duplicados.
const VENTANA_DEDUP_MS = 2000

export const scannerWeb: ScannerService = {
  async estaDisponible(): Promise<boolean> {
    return 'BarcodeDetector' in globalThis
  },

  async iniciar(alDetectar: (lectura: LecturaCodigo) => void): Promise<SesionEscaneo> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })

    // Sin lista explícita de formatos: en bodega no sabemos todavía qué
    // traen las etiquetas de fábrica, así que se aceptan todos los soportados.
    const formatos = await BarcodeDetector.getSupportedFormats()
    const detector = new BarcodeDetector({ formats: formatos })

    // Video interno (nunca se monta en el DOM) del que el detector toma
    // frames. La pantalla muestra el mismo stream en su propio <video>.
    const video = document.createElement('video')
    video.playsInline = true
    video.muted = true
    video.srcObject = stream
    await video.play()

    let activa = true
    let ultimoValor = ''
    let ultimoTimestamp = 0

    const tick = async (): Promise<void> => {
      if (!activa) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const codigos = await detector.detect(video)
          for (const codigo of codigos) {
            const ahora = Date.now()
            if (codigo.rawValue === ultimoValor && ahora - ultimoTimestamp < VENTANA_DEDUP_MS) {
              continue
            }
            ultimoValor = codigo.rawValue
            ultimoTimestamp = ahora
            alDetectar({ valorCrudo: codigo.rawValue, formato: codigo.format })
          }
        } catch {
          // detect() puede fallar en frames sueltos (p. ej. video en pausa);
          // se ignora el frame y se reintenta en el siguiente tick.
        }
      }
      if (activa) {
        setTimeout(tick, INTERVALO_DETECCION_MS)
      }
    }
    setTimeout(tick, INTERVALO_DETECCION_MS)

    return {
      stream,
      detener() {
        activa = false
        video.srcObject = null
        for (const track of stream.getTracks()) {
          track.stop()
        }
      },
    }
  },
}
