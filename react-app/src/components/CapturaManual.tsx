import { useState } from 'react'

interface Props {
  abierta: boolean
  onConfirmar: (numeroSerie: string) => void
  // Sin onCerrar (p. ej. cuando no hay detector y esta es la única vía de
  // captura) no se muestra el botón de cerrar.
  onCerrar?: () => void
}

// Captura manual del número de serie (regla 5 de CLAUDE.md): toda pantalla
// de escaneo la ofrece siempre, para etiquetas ilegibles o dañadas.
export function CapturaManual({ abierta, onConfirmar, onCerrar }: Props) {
  const [numeroSerie, setNumeroSerie] = useState('')

  if (!abierta) {
    return null
  }

  const confirmar = () => {
    const valor = numeroSerie.trim()
    if (valor === '') {
      return
    }
    onConfirmar(valor)
    setNumeroSerie('')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-marino-900/70">
      <form
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-8"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <h2 className="mb-3 text-lg font-bold text-tinta">Teclear número de serie</h2>
        <input
          className="w-full rounded-xl border-2 border-cian bg-white p-4 font-mono text-2xl text-tinta shadow-[0_2px_6px_rgba(18,181,201,.12)] placeholder:text-tinta-3 focus:outline-none"
          value={numeroSerie}
          onChange={(e) => setNumeroSerie(e.target.value)}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="Número de serie"
        />
        <div className="mt-4 flex gap-3">
          {onCerrar !== undefined && (
            <button
              type="button"
              className="h-14 flex-1 rounded-xl bg-panel text-lg font-bold text-tinta ring-1 ring-borde active:bg-borde"
              onClick={() => {
                setNumeroSerie('')
                onCerrar()
              }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="h-14 flex-1 rounded-xl bg-gradient-to-br from-cian to-cian-600 text-lg font-bold text-white shadow-cian active:opacity-90 disabled:opacity-40"
            disabled={numeroSerie.trim() === ''}
          >
            Registrar
          </button>
        </div>
      </form>
    </div>
  )
}
