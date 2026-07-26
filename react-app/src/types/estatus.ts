// Los dos ejes de estatus del sistema (CLAUDE.md Parte II §3).
// "Dónde está" y "en qué condición está" son independientes: un refri puede
// estar colocado en una tienda Y marcado como chatarra. Ambos ejes se
// validan también en el backend.

export type EstatusUbicacion = 'EN_ALMACEN' | 'EN_UBICACION' | 'EN_REPARACION'
export type EstatusCondicion = 'OPERATIVO' | 'MANTENIMIENTO' | 'REFURBISH' | 'CHATARRA'
export type ReparacionTipo = 'INTERNA' | 'EXTERNA'
export type Rol = 'TECNICO' | 'ENCARGADO' | 'ADMIN'

export const ESTATUS_UBICACION: readonly EstatusUbicacion[] = [
  'EN_ALMACEN',
  'EN_UBICACION',
  'EN_REPARACION',
]

export const ESTATUS_CONDICION: readonly EstatusCondicion[] = [
  'OPERATIVO',
  'MANTENIMIENTO',
  'REFURBISH',
  'CHATARRA',
]

export const ETIQUETA_UBICACION: Record<EstatusUbicacion, string> = {
  EN_ALMACEN: 'En almacén',
  EN_UBICACION: 'En ubicación',
  EN_REPARACION: 'En reparación',
}

export const ETIQUETA_CONDICION: Record<EstatusCondicion, string> = {
  OPERATIVO: 'Operativo',
  MANTENIMIENTO: 'Mantenimiento',
  REFURBISH: 'Refurbish',
  CHATARRA: 'Chatarra',
}

// Clases Tailwind por estatus (design system: pastilla clara + punto de
// color), para insignias consistentes en toda la app.
export const COLOR_UBICACION: Record<EstatusUbicacion, string> = {
  EN_ALMACEN: 'bg-marino-100 text-marino',
  EN_UBICACION: 'bg-cian-100 text-cian-600',
  EN_REPARACION: 'bg-alerta-bg text-alerta-tx',
}

export const PUNTO_UBICACION: Record<EstatusUbicacion, string> = {
  EN_ALMACEN: 'bg-marino',
  EN_UBICACION: 'bg-cian',
  EN_REPARACION: 'bg-alerta-dot',
}

export const COLOR_CONDICION: Record<EstatusCondicion, string> = {
  OPERATIVO: 'bg-exito-bg text-exito-tx',
  MANTENIMIENTO: 'bg-alerta-bg text-alerta-tx',
  REFURBISH: 'bg-refur-bg text-refur-tx',
  CHATARRA: 'bg-peligro-bg text-peligro-tx',
}

export const PUNTO_CONDICION: Record<EstatusCondicion, string> = {
  OPERATIVO: 'bg-exito-dot',
  MANTENIMIENTO: 'bg-alerta-dot',
  REFURBISH: 'bg-cian',
  CHATARRA: 'bg-peligro-dot',
}
