import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../services'
import { useSesion } from '../context/SesionContext'
import { Cabecera, Cargando, MensajeError } from '../components/ui'
import type { Almacen, Usuario } from '../types/api'
import type { Rol } from '../types/estatus'

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'ADMIN', etiqueta: 'Superadmin' },
  { valor: 'ENCARGADO', etiqueta: 'Encargado' },
  { valor: 'TECNICO', etiqueta: 'Técnico' },
]

const estiloCampo =
  'w-full rounded-lg border border-borde bg-white px-3 py-2.5 text-tinta shadow-carta placeholder:text-tinta-3 focus:border-cian focus:outline-none disabled:bg-panel disabled:text-tinta-3'

// Administración de usuarios (solo ADMIN): invitar por correo — Catalyst
// manda el email para fijar contraseña — y asignar rol/almacén sin pisar la
// consola de Catalyst. El backend valida todo de nuevo (regla 8).
export default function UsuariosPage() {
  const { usuario: yo } = useSesion()
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  // Formulario de invitación
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState<Rol>('TECNICO')
  const [almacenId, setAlmacenId] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([api.listarUsuarios(), api.almacenes()])
      setUsuarios(u.data)
      setAlmacenes(a.data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar la lista')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function invitar(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      const r = await api.invitarUsuario({
        nombre: nombre.trim(),
        correo: correo.trim(),
        rol,
        almacen_id: almacenId || undefined,
      })
      setAviso(
        r.invitado
          ? `Invitación enviada a ${r.usuario.correo}. Debe abrir el correo de Zoho Catalyst y fijar su contraseña.`
          : `${r.usuario.correo} ya existía en Authentication; se le dio acceso con rol ${r.usuario.rol}.`,
      )
      setNombre('')
      setCorreo('')
      setRol('TECNICO')
      setAlmacenId('')
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la invitación')
    } finally {
      setEnviando(false)
    }
  }

  async function actualizar(u: Usuario, cambios: Parameters<typeof api.actualizarUsuario>[1]) {
    setError('')
    setAviso('')
    try {
      await api.actualizarUsuario(u.ROWID, cambios)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo actualizar')
    }
  }

  const nombreAlmacen = (id: string | null) =>
    almacenes.find((a) => a.ROWID === id)?.nombre ?? '—'

  return (
    <main className="min-h-dvh bg-lienzo pb-16">
      <Cabecera titulo="Usuarios" subtitulo="Invitaciones, roles y accesos" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-5">
        {/* Invitar */}
        <form
          onSubmit={invitar}
          className="space-y-3 rounded-carta border border-borde bg-white p-4 shadow-carta"
        >
          <h2 className="font-bold text-tinta">Invitar usuario</h2>
          <input
            className={estiloCampo}
            placeholder="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className={estiloCampo}
            type="email"
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <select className={estiloCampo} value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
            <select
              className={estiloCampo}
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
            >
              <option value="">Sin almacén base</option>
              {almacenes.map((a) => (
                <option key={a.ROWID} value={a.ROWID}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="h-12 w-full rounded-xl bg-gradient-to-br from-cian to-cian-600 font-bold text-white shadow-cian active:opacity-90 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar invitación'}
          </button>
          <p className="text-xs text-tinta-3">
            Le llegará un correo de Zoho Catalyst para fijar su contraseña; al terminar ya puede
            entrar a la app con el rol asignado.
          </p>
        </form>

        {aviso && (
          <div className="rounded-xl bg-exito-bg p-4 text-sm font-medium text-exito-tx">
            {aviso}
          </div>
        )}
        {error && <MensajeError texto={error} />}

        {/* Lista */}
        {usuarios === null ? (
          <Cargando texto="Cargando usuarios…" />
        ) : (
          <div className="space-y-3">
            {usuarios.map((u) => {
              const esYo = yo !== null && u.catalyst_user_id === yo.catalyst_user_id
              const activo = String(u.activo) !== 'false'
              return (
                <div
                  key={u.ROWID}
                  className={`rounded-carta border border-borde bg-white p-4 shadow-carta ${activo ? '' : 'opacity-60'}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-tinta">
                        {u.nombre}
                        {esYo && <span className="ml-2 text-xs font-normal text-cian-600">(tú)</span>}
                      </p>
                      <p className="truncate text-sm text-tinta-2">{u.correo}</p>
                      <p className="text-xs text-tinta-3">Almacén: {nombreAlmacen(u.almacen_id)}</p>
                    </div>
                    {!activo && (
                      <span className="shrink-0 rounded-full bg-peligro-bg px-2.5 py-1 text-xs font-semibold text-peligro-tx">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <select
                      className={estiloCampo}
                      value={u.rol}
                      disabled={esYo}
                      onChange={(e) => void actualizar(u, { rol: e.target.value as Rol })}
                    >
                      {ROLES.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {r.etiqueta}
                        </option>
                      ))}
                    </select>
                    <select
                      className={estiloCampo}
                      value={u.almacen_id ?? ''}
                      onChange={(e) => void actualizar(u, { almacen_id: e.target.value || null })}
                    >
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.ROWID} value={a.ROWID}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={esYo}
                      onClick={() => void actualizar(u, { activo: !activo })}
                      className="col-span-2 rounded-lg bg-panel px-3 py-2.5 font-semibold text-tinta ring-1 ring-borde active:bg-borde disabled:opacity-40 sm:col-span-1"
                    >
                      {activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </div>
                </div>
              )
            })}
            {usuarios.length === 0 && (
              <p className="py-8 text-center text-sm text-tinta-3">Sin usuarios todavía.</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
