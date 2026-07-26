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
    if (!auth.sdkDisponible()) {
      setEstado('sin-sdk')
      return
    }
    const autenticado = await auth.estaAutenticado()
    if (!autenticado) {
      setEstado('sin-sesion')
      return
    }
    try {
      const { usuario: u } = await api.yo()
      setUsuario(u)
      setEstado('lista')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setEstado('sin-registro')
      } else if (err instanceof ApiError && err.status === 401) {
        setEstado('sin-sesion')
      } else {
        // Backend caído u otro error: tratar como sin registro para mostrar
        // un mensaje útil en vez de una pantalla en blanco.
        setEstado('sin-registro')
      }
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
