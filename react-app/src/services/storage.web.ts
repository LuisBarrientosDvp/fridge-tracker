import { liveQuery } from 'dexie'
import type { Evento } from '../types/evento'
import type { EventoEncolado, SyncQueue } from './storage'
import { db } from './db'

export const storageWeb: SyncQueue = {
  async encolar(evento: Evento): Promise<void> {
    await db.eventos.add({ ...evento, sincronizado: 0 })
  },

  async pendientes(): Promise<EventoEncolado[]> {
    return db.eventos.where('sincronizado').equals(0).sortBy('fechaEvento')
  },

  async todos(): Promise<EventoEncolado[]> {
    return db.eventos.orderBy('fechaEvento').reverse().toArray()
  },

  async marcarSincronizado(uuid: string): Promise<void> {
    await db.eventos.update(uuid, { sincronizado: 1 })
  },

  async contarPendientes(): Promise<number> {
    return db.eventos.where('sincronizado').equals(0).count()
  },

  suscribirCambios(callback: () => void): () => void {
    // liveQuery re-ejecuta la consulta cuando cambia la tabla observada.
    // Se observa el par [total, pendientes] para cubrir tanto encolar
    // (cambia el total) como marcarSincronizado (cambia pendientes).
    const subscripcion = liveQuery(async () => [
      await db.eventos.count(),
      await db.eventos.where('sincronizado').equals(0).count(),
    ]).subscribe({
      next: () => callback(),
    })
    return () => subscripcion.unsubscribe()
  },
}
