// Punto único de acceso a capacidades del dispositivo (regla 1 de CLAUDE.md).
// El resto de la app importa SOLO desde 'src/services' — nunca una
// implementación .web.ts directa, y nunca una API del navegador.
//
// TODO(nativo): cuando entre Capacitor, este archivo elige la implementación
// con Capacitor.isNativePlatform():
//
//   import { Capacitor } from '@capacitor/core'
//   export const scanner = Capacitor.isNativePlatform() ? scannerNative : scannerWeb
//
// (scanner.native.ts usará @capacitor-mlkit/barcode-scanning — verificar
// isGoogleBarcodeScannerModuleAvailable() antes de usarlo, ver gotchas —,
// storage.native.ts usará @capacitor-community/sqlite, etc.)
// Nada fuera de esta carpeta debe cambiar.

import type { AuthService } from './auth'
import { authWeb } from './auth.web'
import type { CameraService } from './camera'
import { cameraWeb } from './camera.web'
import type { HapticsService } from './haptics'
import { hapticsWeb } from './haptics.web'
import type { LocationService } from './location'
import { locationWeb } from './location.web'
import type { ScannerService } from './scanner'
import { scannerWeb } from './scanner.web'
import type { SyncQueue } from './storage'
import { storageWeb } from './storage.web'

export const scanner: ScannerService = scannerWeb
export const storage: SyncQueue = storageWeb
export const camera: CameraService = cameraWeb
export const location: LocationService = locationWeb
export const haptics: HapticsService = hapticsWeb
export const auth: AuthService = authWeb

export { api, ApiError } from './api'
export type {
  AltaEquipo,
  CambioEstatus,
  CambioUsuario,
  FiltrosEquipos,
  InvitacionUsuario,
  NuevoLugar,
} from './api'
export type { AuthService } from './auth'
export type { LecturaCodigo, ScannerService, SesionEscaneo } from './scanner'
export type { EventoEncolado, SyncQueue } from './storage'
export type { CameraService } from './camera'
export type { LocationService } from './location'
export type { HapticsService } from './haptics'
