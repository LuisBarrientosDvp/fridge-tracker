import { useEffect, useRef } from 'react'
import { auth } from '../services'
import { useSesion } from '../context/SesionContext'

// Primera pantalla de la app: inicio de sesión con Catalyst Authentication.
// El widget oficial se monta en un contenedor propio; cuando la sesión queda
// activa, el proveedor de sesión detecta el cambio y muestra el menú.
export default function LoginPage() {
  const { estado, recargar } = useSesion()
  const montado = useRef(false)

  useEffect(() => {
    if (estado === 'sin-sesion' && !montado.current && auth.sdkDisponible()) {
      montado.current = true
      auth.montarLogin('login-catalyst')
    }
  }, [estado])

  // El widget vive en un iframe: sondear la sesión para enterarnos del login
  // sin depender de la redirección configurada en la consola.
  useEffect(() => {
    if (estado !== 'sin-sesion') return
    const t = window.setInterval(async () => {
      if (await auth.estaAutenticado()) {
        window.clearInterval(t)
        recargar()
      }
    }, 1500)
    return () => window.clearInterval(t)
  }, [estado, recargar])

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Identidad */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-emerald-500 text-4xl shadow-lg shadow-emerald-500/20">
            ❄️
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">Fridge Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">
            Trazabilidad de equipos de frío · Comarca Lagunera
          </p>
        </div>

        {/* Widget de login de Catalyst */}
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div id="login-catalyst" className="min-h-[320px]" />
        </div>

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
