import type { Evento } from '../types/evento'

// Cola offline de eventos. Se encolan eventos, nunca estados (regla 2 de
// CLAUDE.md): el estatus vigente se deriva reproduciendo los eventos.

export interface EventoEncolado extends Evento {
  // 0 | 1 en lugar de boolean porque IndexedDB no acepta booleanos como
  // llave de índice, y pendientes() filtra por este campo.
  sincronizado: 0 | 1
}

export interface SyncQueue {
  encolar(evento: Evento): Promise<void>
  // Eventos aún no sincronizados, en orden de fechaEvento.
  pendientes(): Promise<EventoEncolado[]>
  // Todos los eventos (sincronizados o no), del más reciente al más viejo.
  // Lo usa la pantalla de depuración.
  todos(): Promise<EventoEncolado[]>
  marcarSincronizado(uuid: string): Promise<void>
  contarPendientes(): Promise<number>
  // Notifica cuando la cola cambia (algo se encoló o se sincronizó).
  // Devuelve la función para desuscribirse. Lo usan los hooks de React.
  suscribirCambios(callback: () => void): () => void
}

// TODO(backend): aquí NO va el sync. Cuando exista el backend, un módulo
// aparte (p. ej. sync.ts) tomará pendientes(), los mandará en lote a
// POST /eventos (recibe el arreglo de eventos con su uuid; el servidor
// ignora uuids ya insertados y responde qué uuids quedaron persistidos)
// y llamará marcarSincronizado(uuid) por cada confirmado. La cola de fotos
// será OTRA cola, de menor prioridad (regla 6).
