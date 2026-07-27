// Formas de los datos que devuelve la Advanced I/O Function (/server/api).
// Los renglones del Data Store llegan con ROWID/CREATEDTIME como strings.

import type { EstatusCondicion, EstatusUbicacion, ReparacionTipo, Rol } from './estatus'

// El Data Store devuelve los boolean a veces como string ("true"/"false");
// comparar contra 'false' cubre ambos casos sin regar el hack por la app.
export function esActivo(valor: string | boolean): boolean {
  return String(valor) !== 'false'
}

export interface Usuario {
  ROWID: string
  catalyst_user_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  rol: Rol
  almacen_id: string | null
  activo: string | boolean
}

export interface Almacen {
  ROWID: string
  nombre: string
  codigo_interno: string | null
  municipio: string | null
  estado: string | null
  lat: string | null
  lng: string | null
  activo: string | boolean
}

export interface Lugar {
  ROWID: string
  tipo: 'PUNTO_VENTA' | 'TALLER'
  nombre: string
  nombre_normalizado: string
  municipio: string | null
  estado: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  lat: string | null
  lng: string | null
}

export interface Equipo {
  ROWID: string
  serial: string | null
  num_activo: string | null
  marca: string
  modelo: string | null
  equipo_tipo: string
  anio: string | null
  cerveza: string | null
  almacen_id: string
  estatus_ubicacion: EstatusUbicacion
  estatus_condicion: EstatusCondicion
  lugar_actual_id: string | null
  reparacion_tipo: ReparacionTipo | null
  almacen_reparacion_id: string | null
  origen_registro: 'IMPORTACION' | 'CAMPO'
  registrado_por: string
  fecha_registro: string
  fecha_ingreso_real: string | null
  CREATEDTIME: string
}

export interface CodigoEquipo {
  ROWID: string
  refrigerador_id: string
  codigo: string
  formato: string
  es_principal: string | boolean
}

export interface Movimiento {
  ROWID: string
  refrigerador_id: string
  uuid_cliente: string
  tipo_evento: 'ALTA' | 'CAMBIO_UBICACION' | 'CAMBIO_CONDICION' | 'TRASLADO' | 'REPARACION'
  estatus_ubicacion_ant: EstatusUbicacion | null
  estatus_ubicacion_nuevo: EstatusUbicacion | null
  estatus_condicion_ant: EstatusCondicion | null
  estatus_condicion_nuevo: EstatusCondicion | null
  lugar_id: string | null
  almacen_anterior_id: string | null
  almacen_nuevo_id: string | null
  reparacion_tipo: ReparacionTipo | null
  nota: string | null
  usuario_id: string
  fecha_evento: string
  fecha_registro: string
  lat: string | null
  lng: string | null
}

export interface CatalogoItem {
  ROWID: string
  tipo_catalogo: 'MARCA' | 'MODELO' | 'EQUIPO_TIPO' | 'CERVEZA'
  valor: string
}
