import type { DeviceService, TipoDispositivo } from './device'

// Detección por user agent, suficiente para una etiqueta informativa.
// Ojo: iPadOS 13+ se reporta como "Macintosh"; se distingue por touch.
function detectar(): TipoDispositivo {
  if (typeof navigator === 'undefined') return 'PC'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iOS'
  if (/Mobi/i.test(ua)) return 'Móvil'
  return 'PC'
}

export const deviceWeb: DeviceService = {
  tipo: detectar,
}
