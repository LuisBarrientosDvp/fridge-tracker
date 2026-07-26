import type { AuthService } from './auth'

function sdk() {
  return window.catalyst
}

function leerCookie(nombre: string): string | null {
  const partes = document.cookie.split('; ')
  for (const parte of partes) {
    if (parte.startsWith(nombre + '=')) {
      return decodeURIComponent(parte.slice(nombre.length + 1))
    }
  }
  return null
}

export const authWeb: AuthService = {
  sdkDisponible(): boolean {
    return typeof window !== 'undefined' && window.catalyst !== undefined
  },

  async estaAutenticado(): Promise<boolean> {
    const catalyst = sdk()
    if (!catalyst) return false
    try {
      const r: any = await catalyst.auth.isUserAuthenticated()
      return Boolean(r)
    } catch {
      return false
    }
  },

  montarLogin(elementId: string): void {
    const catalyst = sdk()
    if (!catalyst) return
    catalyst.auth.signIn(elementId)
  },

  cerrarSesion(): void {
    const catalyst = sdk()
    if (!catalyst) return
    // Vuelve a la raíz de la app hospedada (el login se muestra de nuevo).
    catalyst.auth.signOut('/app/index.html')
  },

  async encabezados(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    const catalyst = sdk()
    // Camino 1 (spec §1.2): token de una hora en el header Authorization.
    try {
      if (catalyst?.auth.generateAuthToken) {
        const t: any = await catalyst.auth.generateAuthToken()
        const token = t?.access_token ?? t?.content?.access_token
        if (token) headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // Sin token: mismo dominio → las cookies de sesión autentican igual.
    }
    // Camino 2: cookies del mismo dominio + header CSRF que exige Catalyst
    // en peticiones de escritura autenticadas por cookie.
    const csrf = leerCookie('ZD_CSRF_TOKEN')
    if (csrf) headers['ZCSRF-TOKEN'] = `csrfParam=${csrf}`
    return headers
  },
}
