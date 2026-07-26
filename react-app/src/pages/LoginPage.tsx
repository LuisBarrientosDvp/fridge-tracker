import { useSesion } from '../context/SesionContext'

// Primera pantalla de la app: inicio de sesión con Catalyst Authentication.
// Se usa la página de login HOSPEDADA por Catalyst vía botón explícito —
// nunca redirigir automáticamente: montar el widget/redirect en automático
// provocaba un bucle infinito entre /app y /__catalyst/auth/login cuando la
// verificación de sesión del SDK discrepaba del servidor.
export default function LoginPage() {
  const { estado } = useSesion()

  // Sin parámetros: el endpoint hospedado rechaza redirect_url con
  // PATTERN_NOT_MATCHED. A dónde regresa tras el login se configura en la
  // consola (Authentication → Hosted → redirect), no aquí.
  const urlLogin = '/__catalyst/auth/login'

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Identidad */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-emerald-500 text-4xl shadow-lg shadow-emerald-500/20">
            ❄️
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">Fridge Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">
            Trazabilidad de equipos de frío · Comarca Lagunera
          </p>
        </div>

        <a
          href={urlLogin}
          className="flex h-16 w-full max-w-md items-center justify-center rounded-2xl bg-emerald-500 text-lg font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 active:bg-emerald-400"
        >
          Iniciar sesión
        </a>
        <p className="mt-3 max-w-md text-center text-xs text-slate-500">
          Entra con el correo y la contraseña de tu invitación. Si aún no
          aceptas la invitación, revisa tu correo (remitente: Zoho Catalyst).
        </p>

        {estado === 'sin-sdk' && (
          <div className="mt-6 max-w-md rounded-xl bg-amber-500/10 p-4 text-center text-sm text-amber-300 ring-1 ring-amber-500/30">
            El inicio de sesión solo funciona en la app publicada (
            <span className="font-mono">…catalystserverless.com/app</span>). En el servidor local
            de desarrollo no hay SDK de Catalyst.
          </div>
        )}
      </div>
      <p className="pb-4 text-center text-xs text-slate-600">PACNOR · demo v0.1</p>
    </main>
  )
}
