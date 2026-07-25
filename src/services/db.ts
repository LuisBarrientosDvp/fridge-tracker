import Dexie, { type EntityTable } from 'dexie'
import type { EventoEncolado } from './storage'

// Esquema Dexie (IndexedDB). Solo lo usa storage.web.ts — el resto de la
// app pasa por la interfaz SyncQueue.

type FridgeTrackerDb = Dexie & {
  eventos: EntityTable<EventoEncolado, 'uuid'>
}

export const db = new Dexie('fridge-tracker') as FridgeTrackerDb

db.version(1).stores({
  // uuid es la llave primaria (idempotencia). Índices en sincronizado
  // (la cola filtra por él), numeroSerie y fechaEvento (historial por equipo).
  eventos: 'uuid, sincronizado, numeroSerie, fechaEvento',
})
