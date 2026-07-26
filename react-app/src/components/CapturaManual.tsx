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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80">
      <form
        className="w-full max-w-md rounded-t-2xl bg-slate-800 p-5 pb-8"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <h2 className="mb-3 text-lg font-bold text-slate-100">Teclear número de serie</h2>
        <input
          className="w-full rounded-lg border-2 border-slate-500 bg-slate-900 p-4 font-mono text-2xl text-slate-100 focus:border-emerald-400 focus:outline-none"
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
              className="h-14 flex-1 rounded-lg bg-slate-600 text-lg font-bold text-slate-100 active:bg-slate-500"
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
            className="h-14 flex-1 rounded-lg bg-emerald-500 text-lg font-bold text-emerald-950 active:bg-emerald-400 disabled:opacity-40"
            disabled={numeroSerie.trim() === ''}
          >
            Registrar
          </button>
        </div>
      </form>
    </div>
  )
}
