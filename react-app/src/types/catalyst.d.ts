// Tipos mínimos del Web SDK de Catalyst (se carga por <script> en
// public/index.html; solo existe cuando la app corre en el dominio del
// proyecto — en npm start local window.catalyst es undefined).

interface CatalystAuth {
  signIn(elementId: string, config?: Record<string, unknown>): void
  signOut(redirectUrl: string): void
  isUserAuthenticated(): Promise<unknown>
  generateAuthToken?(): Promise<{ access_token?: string; [k: string]: unknown }>
}

interface CatalystSDK {
  auth: CatalystAuth
}

interface Window {
  catalyst?: CatalystSDK
}
