import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, ApiError, auth } from '../services'
import type { Usuario } from '../types/api'

// Estado de la sesión de toda la app:
//  cargando     — revisando si hay sesión de Catalyst
//  sin-sesion   — no hay login: mostrar LoginPage
//  sin-registro — hay login pero el correo no está en la tabla Usuario (403)
//  sin-sdk      — la app corre fuera del dominio de Catalyst (npm start local)
//  lista        — sesión completa, `usuario` disponible con su rol
type EstadoSesion = 'cargando' | 'sin-sesion' | 'sin-registro' | 'sin-sdk' | 'lista'

interface Sesion {
  estado: EstadoSesion
  usuario: Usuario | null
  recargar: () => void
  cerrarSesion: () => void
}

const SesionContext = createContext<Sesion>({
  estado: 'cargando',
  usuario: null,
  recargar: () => undefined,
  cerrarSesion: () => undefined,
})

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  const cargar = useCallback(async () => {
    setEstado('cargando')
    // La fuente de verdad de la sesión es el backend (GET /yo valida las
    // cookies/token en el servidor). isUserAuthenticated() del SDK puede
    // discrepar y causaba un bucle de redirecciones con el login hospedado.
    try {
      const { usuario: u } = await api.yo()
      setUsuario(u)
      setEstado('lista')
      return
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setEstado('sin-registro')
        return
      }
      if (err instanceof ApiError && err.status === 401) {
        setEstado(auth.sdkDisponible() ? 'sin-sesion' : 'sin-sdk')
        return
      }
      // Red caída o dev local sin backend: mostrar login con aviso.
      setEstado(auth.sdkDisponible() ? 'sin-sesion' : 'sin-sdk')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <SesionContext.Provider
      value={{
        estado,
        usuario,
        recargar: () => void cargar(),
        cerrarSesion: () => auth.cerrarSesion(),
      }}
    >
      {children}
    </SesionContext.Provider>
  )
}

export function useSesion(): Sesion {
  return useContext(SesionContext)
}
