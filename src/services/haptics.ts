// Vibración para confirmar una lectura sin mirar la pantalla.
// No está en la lista de servicios de CLAUDE.md, pero la regla 1 prohíbe
// llamar navigator.vibrate directo desde una pantalla, así que es servicio.

export interface HapticsService {
  // No hace nada si el dispositivo no soporta vibración (p. ej. desktop).
  vibrar(duracionMs: number): void
}
