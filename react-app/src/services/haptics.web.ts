import type { HapticsService } from './haptics'

export const hapticsWeb: HapticsService = {
  vibrar(duracionMs: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(duracionMs)
    }
  },
}
