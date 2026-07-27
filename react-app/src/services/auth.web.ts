import type { AuthService } from './auth'

function sdk() {
  return window.catalyst
}

// El SDK puede colgarse en dispositivos sin sesión (su flujo interno de
// clientoauth dispara una petición con jwt_token=undefined que muere por CORS
// y la promesa nunca se resuelve → "Verificando sesión" eterno). Todo lo que
// venga del SDK corre con timeout.
function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      window.setTimeout(() => rechazar(new Error('timeout del SDK')), ms),
    ),
  ])
}

// Logout manual: <auth_domain>/accounts/p/<zaid>/logout — la URL que el SDK
// debería armar pero construye relativa (rota en este hosting). El ZAID y
// el dominio de accounts cambian entre dev y prod, así que se leen de
// /__catalyst/sdk/init.js (script público del mismo origen que configura el
// SDK) en vez de hardcodearlos. IAM termina la sesión y redirige a destino.
async function logoutManual(destino: string): Promise<void> {
  try {
    const res = await fetch('/__catalyst/sdk/init.js')
    const texto = await res.text()
    const zaid = /["']?zaid["']?\s*:\s*["']?(\d+)/i.exec(texto)?.[1]
    const dominio =
      /["']?auth_domain["']?\s*:\s*["']([^"']+)["']/i.exec(texto)?.[1]
    if (zaid && dominio) {
      window.location.href =
        `${dominio}/accounts/p/${zaid}/logout?servicename=ZohoCatalyst&serviceurl=` +
        encodeURIComponent(destino)
      return
    }
  } catch {
    // sin red o fuera del dominio hospedado: recargar y que /yo decida
  }
  window.location.href = destino
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
    // Sin cookie de sesión no hay nada que verificar: preguntar al SDK sin
    // sesión dispara su flujo interno de clientoauth con jwt_token=undefined
    // (ruido CORS en consola y segundos perdidos).
    if (!leerCookie('ZD_CSRF_TOKEN')) return false
    try {
      const r: any = await conTimeout(catalyst.auth.isUserAuthenticated(), 6000)
      return Boolean(r)
    } catch {
      return false
    }
  },

  montarLogin(elementId: string): void {
    const catalyst = sdk()
    if (!catalyst) return
    // login_redirect con la ruta legacy /app/index.html (hosting web clásico;
    // si se migra a Slate cambia a '/'). Sin esto el widget puede redirigir
    // a una ruta que no existe (PATTERN_NOT_MATCHED).
    catalyst.auth.signIn(elementId, {
      login_redirect: window.location.origin + '/app/index.html',
    })
  },

  cerrarSesion(): void {
    // NO usar catalyst.auth.signOut(): el SDK 4.6.1 arma una URL RELATIVA
    // (constructSignOutUrl → "/accounts/p/<zaid>/logout...") que NO existe
    // en el dominio serverless — el hosting la rebota a /app/index.html y
    // la sesión sigue viva (el clic parece "no hacer nada" / vuelve a
    // #/menu). Verificado en el fuente del SDK y probando la ruta en el
    // dominio. El logout real vive en accounts.zohoportal.com.
    void logoutManual(window.location.origin + '/app/index.html')
  },

  async encabezados(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    const catalyst = sdk()
    // Pista barata de sesión: la cookie ZD_CSRF_TOKEN solo existe tras un
    // login en este dominio. Sin ella NO se toca el SDK — generateAuthToken
    // sin sesión dispara clientoauth con jwt_token=undefined (error CORS/500
    // en consola) y quema el timeout; el backend contestará 401 y la app
    // mostrará el login de inmediato.
    const csrf = leerCookie('ZD_CSRF_TOKEN')
    if (!csrf) return headers
    // Camino 1 (spec §1.2): token de una hora en el header Authorization.
    try {
      if (catalyst?.auth.generateAuthToken) {
        const t: any = await conTimeout(catalyst.auth.generateAuthToken(), 6000)
        const token = t?.access_token ?? t?.content?.access_token
        // Token CRUDO, sin prefijo "Bearer": el gateway de Catalyst rechaza
        // el header con prefijo y el backend respondería 401.
        if (token) headers['Authorization'] = token
      }
    } catch {
      // Sin token (timeout o sesión caducada): mismo dominio → las cookies
      // de sesión autentican igual; si tampoco valen, el backend responde
      // 401 y la app muestra el login en vez de colgarse.
    }
    // Camino 2: cookies del mismo dominio + header CSRF que exige Catalyst
    // en peticiones de escritura autenticadas por cookie.
    headers['ZCSRF-TOKEN'] = `csrfParam=${csrf}`
    return headers
  },
}
