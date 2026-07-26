// Capa única de acceso al backend (/server/api, Advanced I/O Function).
// Toda llamada de red de la app pasa por aquí: agrega el token de sesión
// justo antes de cada petición (dura 1 h, nunca se guarda) y normaliza
// errores. Nadie más hace fetch en la app.

import type {
  Almacen,
  CatalogoItem,
  CodigoEquipo,
  Equipo,
  Lugar,
  Movimiento,
  Usuario,
} from '../types/api'
import type { EstatusCondicion, EstatusUbicacion, ReparacionTipo, Rol } from '../types/estatus'
import { authWeb as auth } from './auth.web'

const BASE = '/server/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function llamar<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await auth.encabezados()),
    ...((opciones?.headers as Record<string, string>) ?? {}),
  }
  const res = await fetch(`${BASE}${ruta}`, {
    credentials: 'include',
    ...opciones,
    headers,
  })
  let cuerpo: any = null
  try {
    cuerpo = await res.json()
  } catch {
    // respuestas sin JSON (raro) caen al error genérico de abajo
  }
  if (!res.ok) {
    throw new ApiError(res.status, cuerpo?.error ?? `Error ${res.status}`)
  }
  return cuerpo as T
}

export interface FiltrosEquipos {
  almacen_id?: string
  estatus_ubicacion?: EstatusUbicacion
  estatus_condicion?: EstatusCondicion
  q?: string
  page?: number
  per_page?: number
}

export interface CambioEstatus {
  uuid_cliente: string
  estatus_ubicacion?: EstatusUbicacion
  estatus_condicion?: EstatusCondicion
  lugar_id?: string
  reparacion_tipo?: ReparacionTipo
  almacen_reparacion_id?: string
  nota?: string
  fecha_evento?: string
  lat?: number
  lng?: number
}

export interface AltaEquipo {
  serial?: string
  num_activo?: string
  marca: string
  modelo?: string
  equipo_tipo: string
  anio?: number
  cerveza?: string
  almacen_id?: string
  formato_codigo?: string
  uuid_cliente?: string
  lat?: number
  lng?: number
}

export interface NuevoLugar {
  tipo: 'PUNTO_VENTA' | 'TALLER'
  nombre: string
  municipio?: string
  estado?: string
  contacto_nombre?: string
  contacto_telefono?: string
  lat?: number
  lng?: number
}

export interface InvitacionUsuario {
  correo: string
  nombre: string
  rol: Rol
  almacen_id?: string
  telefono?: string
}

export interface CambioUsuario {
  rol?: Rol
  almacen_id?: string | null
  activo?: boolean
  nombre?: string
  telefono?: string | null
}

export const api = {
  yo: () => llamar<{ usuario: Usuario }>('/yo'),

  // --- usuarios (solo ADMIN) ---
  listarUsuarios: () => llamar<{ data: Usuario[] }>('/usuarios'),

  invitarUsuario: (datos: InvitacionUsuario) =>
    llamar<{ usuario: Usuario; invitado: boolean }>('/usuarios', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  actualizarUsuario: (id: string, cambios: CambioUsuario) =>
    llamar<{ usuario: Usuario }>(`/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  resolverCodigo: (codigo: string) =>
    llamar<{ equipo: Equipo; codigo: CodigoEquipo }>(`/codigos/${encodeURIComponent(codigo)}`),

  listarEquipos: (f: FiltrosEquipos = {}) => {
    const params = new URLSearchParams()
    if (f.almacen_id) params.set('almacen_id', f.almacen_id)
    if (f.estatus_ubicacion) params.set('estatus_ubicacion', f.estatus_ubicacion)
    if (f.estatus_condicion) params.set('estatus_condicion', f.estatus_condicion)
    if (f.q) params.set('q', f.q)
    if (f.page) params.set('page', String(f.page))
    if (f.per_page) params.set('per_page', String(f.per_page))
    const qs = params.toString()
    return llamar<{ data: Equipo[]; page: number; per_page: number; has_more: boolean }>(
      `/equipos${qs ? `?${qs}` : ''}`,
    )
  },

  obtenerEquipo: (id: string) =>
    llamar<{ equipo: Equipo; codigos: CodigoEquipo[]; movimientos: Movimiento[] }>(
      `/equipos/${id}`,
    ),

  crearEquipo: (datos: AltaEquipo) =>
    llamar<{ equipo: Equipo; codigos: CodigoEquipo[] }>('/equipos', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  crearMovimiento: (equipoId: string, cambio: CambioEstatus) =>
    llamar<{ movimiento: Movimiento; idempotente?: boolean }>(
      `/equipos/${equipoId}/movimientos`,
      { method: 'POST', body: JSON.stringify(cambio) },
    ),

  cambiarAlmacen: (equipoId: string, almacenId: string, nota?: string) =>
    llamar<{ movimiento: Movimiento }>(`/equipos/${equipoId}/almacen`, {
      method: 'PATCH',
      body: JSON.stringify({ almacen_id: almacenId, nota, uuid_cliente: crypto.randomUUID() }),
    }),

  buscarLugares: (tipo: 'PUNTO_VENTA' | 'TALLER', q: string) =>
    llamar<{ data: Lugar[] }>(`/lugares?tipo=${tipo}&q=${encodeURIComponent(q)}`),

  crearLugar: (datos: NuevoLugar) =>
    llamar<{ lugar: Lugar; existente: boolean }>('/lugares', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  almacenes: () => llamar<{ data: Almacen[] }>('/almacenes'),

  catalogo: (tipo: 'MARCA' | 'MODELO' | 'EQUIPO_TIPO' | 'CERVEZA') =>
    llamar<{ data: CatalogoItem[] }>(`/catalogos?tipo=${tipo}`),
}
