// Interfaz del servicio de sesión. Envuelve el Web SDK de Catalyst
// (window.catalyst), que solo existe cuando la app corre hospedada en el
// dominio del proyecto. La app importa esto desde src/services (regla 1).

export interface AuthService {
  // false cuando el SDK no cargó (p. ej. npm start local fuera del dominio).
  sdkDisponible(): boolean
  estaAutenticado(): Promise<boolean>
  // Monta el widget de inicio de sesión de Catalyst dentro del elemento dado.
  montarLogin(elementId: string): void
  cerrarSesion(): void
  // Encabezados de autenticación para llamadas al backend. El token dura
  // 1 hora: se pide justo antes de cada llamada y nunca se guarda.
  encabezados(): Promise<Record<string, string>>
}
