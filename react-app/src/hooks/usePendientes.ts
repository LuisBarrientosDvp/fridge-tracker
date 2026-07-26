import { useEffect, useState } from 'react'
import { storage } from '../services'

// Cuenta de eventos sin sincronizar, reactiva a cambios en la cola.
// Alimenta el contador siempre visible (regla 8 de CLAUDE.md).
export function usePendientes(): number {
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    let montado = true

    const actualizar = () => {
      void storage.contarPendientes().then((cuenta) => {
        if (montado) {
          setPendientes(cuenta)
        }
      })
    }

    actualizar()
    const desuscribir = storage.suscribirCambios(actualizar)

    return () => {
      montado = false
      desuscribir()
    }
  }, [])

  return pendientes
}
