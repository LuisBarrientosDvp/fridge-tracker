// Catálogo de estatus del sistema (ver CLAUDE.md).
// Un único estatus vigente por equipo. El vigente se DERIVA reproduciendo
// los eventos en orden de fechaEvento — nunca se guarda como estado suelto.
export type Estatus =
  | 'Recibido'
  | 'En diagnóstico'
  | 'Disponible / OK'
  | 'Con observaciones'
  | 'No funcional / dañado'
  | 'En cuarentena / retenido'
  | 'Apto para salir'
  | 'En tránsito'
  | 'Entregado / Colocado'
  | 'Baja'

// Para poblar selects y validar entradas sin repetir la lista.
export const CATALOGO_ESTATUS: readonly Estatus[] = [
  'Recibido',
  'En diagnóstico',
  'Disponible / OK',
  'Con observaciones',
  'No funcional / dañado',
  'En cuarentena / retenido',
  'Apto para salir',
  'En tránsito',
  'Entregado / Colocado',
  'Baja',
]
