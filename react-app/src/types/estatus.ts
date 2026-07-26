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

// Clases Tailwind por estatus, para insignias consistentes en toda la app.
export const COLOR_UBICACION: Record<EstatusUbicacion, string> = {
  EN_ALMACEN: 'bg-slate-500/20 text-slate-200 ring-slate-400/40',
  EN_UBICACION: 'bg-sky-500/20 text-sky-300 ring-sky-400/40',
  EN_REPARACION: 'bg-amber-500/20 text-amber-300 ring-amber-400/40',
}

export const COLOR_CONDICION: Record<EstatusCondicion, string> = {
  OPERATIVO: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40',
  MANTENIMIENTO: 'bg-amber-500/20 text-amber-300 ring-amber-400/40',
  REFURBISH: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  CHATARRA: 'bg-red-500/20 text-red-300 ring-red-400/40',
}
