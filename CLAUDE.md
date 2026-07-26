# Fridge Tracker — documento único del proyecto

Trazabilidad de refrigeradores rentados con publicidad a puntos de venta en la
Comarca Lagunera. **Fase actual: fullstack sobre Zoho Catalyst, app completa
construida y deployada; login corregido 2026-07-26.** Ante cualquier
conflicto, manda la sección "Especificación v3".

---

# Contexto y plataforma

```
PACNOR DEMO/
├── catalyst.json     # Config CLI (cliente = react-app con plugin React). NO editar a mano
├── .catalystrc       # Identidad del proyecto. NO editar / NO commitear
├── functions/api/    # Advanced I/O Function (Express, node18) — todo el backend
├── react-app/        # Cliente React+TS (PWA), build CRA vía zcatalyst-cli-plugin-react
└── CLAUDE.md         # Este archivo (único documento)
```

- Proyecto Catalyst **DEMO** (`33866000000045392`), DC US, entorno Development
  `890811559`, tz America/Mexico_City.
- App: `https://demo-890811559.development.catalystserverless.com/app/index.html`
- API: `https://demo-890811559.development.catalystserverless.com/server/api/`
- Repo: `https://github.com/LuisBarrientosDvp/fridge-tracker.git` (master).
- Backend: Data Store + **una** función Advanced I/O + Authentication. Sin
  archivos/Stratus; el QR se genera en el cliente.
- Frontend: PWA (un código para técnico Android y admin escritorio; si algún
  día hace falta APK, se envuelve con Capacitor, no se reescribe). Hosting:
  Web Client Hosting legacy; Slate posible después (mismo mecanismo de auth
  si comparten proyecto). Dispositivo objetivo: S26 Ultra, Chrome Android.

## Autenticación (FUNCIONANDO — corregida 2026-07-26)

Frontend y backend en el **mismo proyecto Catalyst** — de eso depende todo.
Login **hospedado** de Catalyst: `/__catalyst/auth/login` (botón explícito en
LoginPage; nunca redirigir en automático).

Lecciones del bucle de login (dos bugs reales, ya corregidos):

1. **Web SDK ≥ 4.6.1 en `public/index.html`.** `generateAuthToken()` existe
   desde 4.6.1 e `isUserAuthenticated()` desde 4.5.0. Con 4.4.0 el token
   nunca se enviaba → `GET /yo` 401 → LoginPage → el login hospedado rebota
   (sí había sesión) → bucle infinito.
2. **Header `Authorization` = token CRUDO**, sin prefijo `Bearer`. El gateway
   de Catalyst valida el header y lo traduce a headers internos
   `x-zc-user-cred-*` para la función; con prefijo la validación falla y el
   backend responde 401 aunque las cookies sean válidas.

Reglas vigentes:
- Token de `generateAuthToken()` → `access_token`, dura **1 h**: se pide
  justo antes de cada llamada, **nunca se guarda**.
- `client-package.json` (raíz de react-app): `"login_redirect": "/app/index.html"`.
- Fuente de verdad de la sesión: `GET /yo` del backend. En 401,
  `isUserAuthenticated()` arbitra: sin sesión → LoginPage; **con** sesión →
  estado `error-auth` (pantalla de error con Reintentar/Salir) — jamás
  reenviar al login hospedado, eso recrea el bucle.
- Respaldo cookies same-origin + header `ZCSRF-TOKEN: csrfParam=<cookie
  ZD_CSRF_TOKEN>` en escrituras.
- **Todo lo del SDK corre con timeout de 6 s** (`auth.web.ts`): en un
  dispositivo sin sesión, `generateAuthToken()` dispara internamente
  `clientoauth/...remote/auth` con `jwt_token=undefined`, muere por CORS y su
  promesa nunca se resuelve → "Verificando sesión" eterno. Con el timeout la
  llamada sigue sin token, el backend responde 401 y aparece el login. La
  pantalla de verificación además ofrece "Cerrar sesión" a los 8 s.
- **No usar API Gateway** para la PWA (API key expuesta, no identifica
  usuario, deshabilita Security Rules). Solo tendría sentido para un ERP
  externo futuro.
- Dominio del cliente dado de alta en CORS/Authorized Domains de
  Authentication. El **ZAID es distinto en dev y prod** — nunca hardcodear.

## Reglas de arquitectura no negociables

1. **Capa de servicios abstraída.** Todo acceso a dispositivo Y red pasa por
   `src/services/` (interfaz + `.web.ts`). `navigator.geolocation` fuera de
   `location.web.ts` está mal. Es lo que permite la fase Capacitor futura.
2. **Encolar eventos, no estados.** El estatus se deriva del historial
   (`Movimiento` append-only). Guardar estados pierde el historial, que es
   el producto.
3. **`uuid_cliente` = idempotencia.** `crypto.randomUUID()` en el
   dispositivo, nunca en el servidor.
4. **`fecha_evento` (reloj del dispositivo) manda** en la lógica;
   `fecha_registro` (servidor) es solo auditoría.
5. **Captura manual siempre disponible** en toda pantalla de escaneo (los
   códigos 1D fallan con etiquetas viejas/grasosas).
6. **Contador de pendientes visible** + advertencia al cerrar sesión con cola
   sin sincronizar.
7. **Fotos (futuro): comprimir antes de encolar, cola separada** (~1200 px,
   JPEG 0.7).
8. **Permisos validados en el backend**, no solo ocultando botones.

## Gotchas

- Escaneo universal ✅: `BarcodeDetector` nativo o ponyfill
  [`barcode-detector`](https://www.npmjs.com/package/barcode-detector)
  (zxing-wasm) — iOS/escritorio también escanean. El ponyfill baja su .wasm
  de jsDelivr la primera vez (requiere red).
- WebKit niega geolocalización con certificado autofirmado: en dev el iPhone
  va sin GPS. HTTPS obligatorio en dev (`HTTPS=true` en `react-app/.env`).
- No está verificado qué trae el código de fábrica (¿serie, modelo, UPC?);
  la pantalla de escaneo muestra la cadena cruda y el formato.
- `sincronizado` en Dexie es `0 | 1` (IndexedDB no indexa booleanos).
- ZCQL limita filas por respuesta → **paginación obligatoria** en listados
  (~9,000 equipos reales esperan). No hay PostGIS: lat/lng Double, haversine
  en la función.
- Data Store: datetimes en la zona del proyecto (America/Mexico_City) — la
  función formatea con `Intl` locale `sv-SE`.
- Antes de Production: clic en "Start Exploring" por servicio y billing
  activo. Catalyst se factura aparte de Zoho One/CRM.
- Build: plugin React (webpack/CRA), no Vite. **Tailwind v3** PostCSS (no
  sintaxis v4). **TypeScript 4.9** (peer de react-scripts 5; babel solo
  quita tipos). `npx tsc --noEmit` marca errores en `@types/node` —
  preexistentes, ignorar; solo importan los de `src/`.
- Fase nativa (futuro): ML Kit descarga módulo vía Play Services; SDK web no
  encaja con origen `capacitor://localhost` (ahí sí JWT propio);
  `@capacitor/camera` 8.1 deprecó `getPhoto`.

## Convenciones y prohibiciones

- **Dominio en español, técnica en inglés** (`numeroSerie`, `fetchInventory`);
  no mezclar en un identificador. TS estricto: catálogos como uniones de
  literales. Mobile-first (guantes, mala luz, una mano). Sin librerías UI
  pesadas: Tailwind + componentes propios.
- NO: plugins Capacitor ahora · APIs del navegador fuera de services ·
  estados en la cola · UUID en servidor · API Gateway · guardar el token ·
  crear tablas a mano en consola (solo CLI/SDK/MCP) · construir traslados
  con doble aprobación, fotos, comodato, offline o catálogos editables ·
  pasar credenciales/tokens por chat (el CLI ya está autenticado).

## Design system (implementado 2026-07-26)

Del mockup de Claude Design (carpeta "Fridge Tracker App", eliminada tras
implementarse). Tema **claro**, tokens en `react-app/tailwind.config.js`:

- `marino` #1F3A5F (barra de app, botón primario; `-900` #16293F titulares,
  `-700` #2E4E75, `-300` #A9BDD1 texto sobre marino, `-100` #EAF1F7).
- `cian` #12B5C9 → `-600` #0E8FA3 (acento; CTA = gradiente cian con
  `shadow-cian`; `-300` #7FE3EF sobre marino; `-50/-100` fondos).
- Fondos `lienzo` #F5FAFC y `panel` #F1F5F8; tarjetas blancas
  `rounded-carta` (16px) + `border-borde` #E4EDF2 + `shadow-carta`;
  divisores `divisor` #EEF3F6. Texto `tinta` #16293F / `-2` #5C6B76 /
  `-3` #8A99A3.
- Pastillas de estatus = fondo claro + punto de color (`COLOR_*` y
  `PUNTO_*` en `types/estatus.ts`): exito/alerta/refur/peligro.
- `oscuro` #101820 solo en la pantalla de escaneo (brackets cian de encuadre).
- Fuente **Roboto** (Google Fonts en `public/index.html`); logo = copo de
  nieve SVG (`LogoCopo` en `components/ui.tsx`).

## Preguntas abiertas con el cliente (no inventar respuestas)

1. ¿Renta con publicidad o comodato? (capa comercial faltante)
2. ¿El patrocinador/vinil cambia durante la vida del equipo?
3. ¿Cómo regresan los equipos? (no hay flujo de retiro)
4. ¿Qué teléfonos usan operadores/choferes? (¿iOS entra?)
5. Volumen real: equipos, almacenes, puntos de venta, usuarios.
6. ¿Quién es dueño de los teléfonos?
7. ¿Un encargado cubre varios almacenes? (modelo ya lo permite)
8. ¿`Modelo` catálogo dependiente de marca o autocompletado? (propuesta:
   autocompletado contra `Catalogo`)

---

# Especificación v3 (autoritativa)

**Incluido:** login · escaneo cámara → resolver código · alta en campo ·
cambio de estatus (2 ejes) · crear/reutilizar lugares · QR PNG · historial ·
tabla admin escritorio · cambio de almacén solo ADMIN directo.
**Fuera:** traslados con doble aprobación (tablas listas, sin UI) · fotos ·
comodato · offline · catálogos editables.

## Dos ejes de estatus (validados en backend)

"Dónde está" y "en qué condición" son independientes (puede estar colocado
Y ser chatarra).

- `estatus_ubicacion`: `EN_ALMACEN` · `EN_UBICACION` (requiere
  `lugar_actual_id` tipo PUNTO_VENTA) · `EN_REPARACION` (INTERNA sin más
  campos o + `almacen_reparacion_id`; EXTERNA + `lugar_actual_id` tipo TALLER).
- `estatus_condicion`: `OPERATIVO` (default) · `MANTENIMIENTO` · `REFURBISH`
  · `CHATARRA`.

## Identificadores: un equipo, N códigos

El serial de placa no es único ni siempre legible (duplicados y "N/D" en los
datos reales). `Refrigerador.serial` es informativo, **sin índice único**; la
unicidad vive en `CodigoEquipo.codigo` (único global). Cualquier código
(placa, número de activo, QR) resuelve a la misma ficha; un equipo sin código
se registra igual y se etiqueta después.

## Modelo de datos — 9 tablas (creadas 2026-07-26 vía MCP)

Notación: `*` = obligatoria. CP siempre **Text** (ceros a la izquierda).
Direcciones opcionales salvo nombre. Índices únicos compuestos no existen en
Data Store → se garantizan en el backend. Desviaciones aceptadas: varchar
tope 255 (`referencia`), `nota` text 10k, lat/lng 4 decimales (~11 m).

- **Almacen** `33866000000043446`: nombre*, codigo_interno, calle,
  numero_ext, numero_int, colonia, municipio, estado, cp, referencia, lat,
  lng, telefono, encargado_principal_id (→Usuario), activo* (def true).
- **Lugar** `33866000000037369` (PUNTO_VENTA y TALLER unificados): tipo*,
  nombre*, nombre_normalizado* (minúsculas sin acentos; único con tipo),
  misma dirección que Almacen, contacto_nombre, contacto_telefono,
  creado_por*, fecha_creacion*. Dedup: el cliente busca por
  `nombre_normalizado` parcial antes de habilitar "crear"; si colisiona, el
  backend devuelve la existente.
- **Usuario** `33866000000044450`: catalyst_user_id* (único), nombre*,
  correo, telefono, rol* (TECNICO|ENCARGADO|ADMIN), almacen_id, activo*.
- **AlmacenEncargado** `33866000000037728` (N:N, para traslados futuros):
  almacen_id* + usuario_id* (único compuesto), puede_aprobar_traslados*
  (def true), fecha_asignacion*.
- **Refrigerador** `33866000000036391`: serial (sin único), num_activo,
  marca*, modelo, equipo_tipo*, anio, cerveza, almacen_id* (almacén casa),
  estatus_ubicacion*, estatus_condicion*, lugar_actual_id, reparacion_tipo
  (INTERNA|EXTERNA), almacen_reparacion_id, origen_registro*
  (IMPORTACION|CAMPO), registrado_por*, fecha_registro*, fecha_ingreso_real.
- **CodigoEquipo** `33866000000040373`: refrigerador_id*, codigo* (**único
  global**), formato* (code_128, qr_code, activo…), es_principal*,
  fecha_alta*. El alta crea el código principal si hay serial; num_activo
  entra como segundo código (`formato=activo`).
- **Movimiento** `33866000000045416` (**append-only**, el estatus del refri
  es denormalizado y se recalcula del último movimiento): refrigerador_id*,
  uuid_cliente* (único, idempotencia), tipo_evento* (ALTA|CAMBIO_UBICACION|
  CAMBIO_CONDICION|TRASLADO|REPARACION), estatus_ubicacion_ant/nuevo,
  estatus_condicion_ant/nuevo, lugar_id, almacen_anterior_id,
  almacen_nuevo_id, reparacion_tipo, nota, usuario_id*, fecha_evento*
  (cliente), fecha_registro* (servidor), lat, lng.
- **SolicitudTraslado** `33866000000035510` (sin UI en esta versión):
  refrigerador_id*, almacen_origen_id*, almacen_destino_id*, solicitado_por*,
  estado* (PENDIENTE|APROBADA|RECHAZADA|CANCELADA), aprobado_origen_por,
  aprobado_destino_por, nota, fecha_solicitud*, fecha_resolucion.
- **Catalogo** `33866000000045809`: tipo_catalogo*
  (MARCA|MODELO|EQUIPO_TIPO|CERVEZA), valor*, activo*.

Permisos: las tablas se tocan **solo** desde la función con scope admin; sin
escritura de App User.

## Endpoints (función `api`, deployada)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/yo` | Usuario autenticado (extra a la spec) |
| GET | `/codigos/:codigo` | Resuelve código → 200 equipo / 404 |
| POST | `/equipos` | Alta; `almacen_id` = el del usuario; crea código principal |
| GET | `/equipos` | Filtros almacén/estatus/búsqueda + paginación; ENCARGADO fijado a su almacén |
| GET | `/equipos/:id` | Ficha + códigos + historial |
| POST | `/equipos/:id/movimientos` | Valida los 2 ejes; idempotente por `uuid_cliente` (repetido → 200 con el existente) |
| PATCH | `/equipos/:id/almacen` | **Solo ADMIN** |
| GET | `/lugares?tipo=&q=` | Busca por `nombre_normalizado` |
| POST | `/lugares` | Crea; colisión de normalización → devuelve existente |
| GET | `/almacenes` · GET `/catalogos?tipo=` | Catálogos |
| GET | `/usuarios` | **Solo ADMIN** — lista |
| POST | `/usuarios` | **Solo ADMIN** — invita: `registerUser()` en Authentication (correo de invitación) + renglón `Usuario` con rol/almacén. Correo repetido en tabla → 409; ya en Auth → reutiliza su user_id |
| PATCH | `/usuarios/:id` | **Solo ADMIN** — rol/almacén/activo/contacto. Sin auto-lockout (no puedes quitarte tu ADMIN); `activo` se sincroniza a Authentication (enable/disable, mejor esfuerzo) |

Middleware: `getCurrentUser()` del token → renglón en `Usuario` → 401 sin
token / 403 sin renglón o inactivo. Data Store con scope admin.

## Flujo de escaneo

Escanear → `GET /codigos/:codigo` → **200**: ficha → cambiar ubicación
(EN_ALMACEN directo · EN_UBICACION busca/crea Lugar · EN_REPARACION
interna/externa) o condición → `POST /equipos/:id/movimientos`. **404**:
formulario de alta con el código precargado en `serial` (editable), almacén
del usuario, estatus inicial EN_ALMACEN + OPERATIVO → `POST /equipos`.

Formatos: code_128, code_39, code_93, ean_13, ean_8, upc_a, itf,
data_matrix, qr_code.

## QR

Cliente puro, librería `qrcode`. **Contenido = `serial`** (no ROWID: mismo
resolvedor que el código de fábrica y sobrevive reimportaciones). 512×512,
corrección M, descarga PNG vía `canvas.toDataURL`.

## Roles

| Acción | TECNICO | ENCARGADO | ADMIN |
|---|---|---|---|
| Escanear, ficha, cambiar estatus, alta, crear lugar | Sí | Sí | Sí |
| Cambiar almacén del equipo | No | No | Sí |
| Tabla de administración | No | Su almacén | Todos |

Producto → sistema: Superadmin=`ADMIN` (Escanear·Mi almacén·Reportes),
Encargado=`ENCARGADO` (Escanear·Mi almacén), Usuario=`TECNICO` (Escanear).
Rutas protegidas en App.tsx y revalidadas en backend.

## Datos semilla

✅ Almacenes: Torreón TRC `33866000000040732`, Gómez Palacio GP
`33866000000040733`, Lerdo LER `33866000000040734`. ✅ Catálogo: marcas
Criotec/Froster/Hussmann/Imbera/Metalfrio/NSF, tipos Refrigerador/Máq.
hielo/Cám. fría, cervezas Corona/Modelo/Budlight/Michelob/Modelorama.
✅ 6 PUNTO_VENTA + 2 TALLER.

⬜ Importación de ~40 renglones de `Inventario_Auditoria.xlsx` hoja TRC
(**conseguir el archivo**). Mapeo: `Series`→serial, `Activo`→num_activo,
`Equipo`→equipo_tipo, `Marca`→marca, `Modelo`→modelo, `Año`→anio,
`Estatus`→estatus_condicion (CHATARRA, PARA REFURBISH→REFURBISH,
MANTENIMIENTO); `estatus_ubicacion`=EN_ALMACEN, `origen_registro`=IMPORTACION.
Limpieza (reutilizable para los ~9,000 reales): deduplicar seriales, saltar
"N/D"/longitud<8, normalizar marcas ("IMBERA" vs "Imbera").

---

# Correr, probar, deployar

Requisitos: Node 22+, `zcatalyst-cli` con sesión, teléfono Android en la
misma Wi-Fi.

```bash
cd react-app && npm install && npm start   # dev HTTPS (cert autofirmado)
catalyst deploy                            # desde la raíz: build + sube cliente y función
```

Teléfono: `https://<ip-local>:3000/` → aceptar certificado → permiso de
cámara. Cada lectura vibra, flash verde, y muestra cadena cruda + formato.
Si no carga: firewall de Windows, VPN, o plan B `adb reverse tcp:3000
tcp:3000` + `https://localhost:3000`. iPhone: escanea vía ponyfill (verificado
iPhone 17, 2026-07-25); sin GPS en dev (cert autofirmado).

## Estructura del cliente

```
react-app/src/
├── types/        estatus.ts (2 ejes, uniones+etiquetas+colores) · api.ts ·
│                 evento.ts (cola legado) · catalyst.d.ts · barcode-detector.d.ts
├── services/     ÚNICA puerta a dispositivo y red (regla 1); index.ts es el
│                 punto de importación. api.ts (toda llamada al backend, token
│                 por llamada) · auth.ts/.web.ts · scanner (nativo/ponyfill) ·
│                 location (GPS best-effort 5 s) · haptics · storage+db.ts
│                 (cola Dexie legado, solo /debug) · camera (stub futuro)
├── context/      SesionContext.tsx — cargando → sin-sesion | sin-registro |
│                 sin-sdk | error-auth | lista
├── components/   ui.tsx · ListaEquipos (filtros/paginación) · BuscadorLugar
│                 (dedup + GPS) · CapturaManual (regla 5)
└── pages/        LoginPage (botón al login hospedado) · MenuPage (por rol) ·
                  EscaneoPage · FichaEquipoPage (estatus+QR+historial) ·
                  AltaEquipoPage · ReportesPage (ADMIN) · AlmacenPage ·
                  UsuariosPage (ADMIN: invitar + roles) · DebugColaPage
```

`pages`/`components` importan **solo** de `src/services` (el index), nunca
una `.web.ts`, un fetch ni una API del navegador. **HashRouter** (`#/…`): el
hosting sirve `/app/index.html` sin rewrites.

Flujo de sesión: `index.html` carga el SDK 4.6.1 + `/__catalyst/sdk/init.js`
(solo existe hospedado) → `SesionContext` llama `GET /yo` → 200 lista · 403
sin-registro · 401 arbitrado por `isUserAuthenticated()` (sin-sesion o
error-auth) · sin SDK (dev local) sin-sdk.

Superadmin actual (rol ADMIN, sin almacén base): `fjavieraf2@gmail.com`
(user_id `33866000000048178`, Usuario ROWID `33866000000042843`, creado
2026-07-26). **Ojo:** al re-habilitar Authentication nativa se borraron los
app users anteriores (`fjavieraf@`, `lbarrientosnajera@`, `l.r.v.m2409@`) y
la tabla `Usuario` quedó vacía; recrearlos si hacen falta (invitación en
Authentication + renglón ADMIN en `Usuario` con su `catalyst_user_id`).

---

# Checklist

**Hecho:** repo conectado · 9 tablas + semillas (salvo Excel) · función `api`
deployada · app completa deployada · login hospedado corregido y deployado
(SDK 4.6.1, token crudo, login_redirect, guardia error-auth) · smoke: `/yo`
sin token → 401, SDK 4.6.1 servido · superadmin `fjavieraf2@gmail.com`
(Authentication + renglón ADMIN, 2026-07-26) · gestión de usuarios en la app
(menú Usuarios, endpoints `/usuarios`, 2026-07-26) · design system claro
marino/cian implementado en toda la app + timeouts del SDK y salida de
emergencia en "Verificando sesión" (2026-07-26).

**Pendiente:**

- [ ] Commit de la corrección de login (index.html, auth.web.ts,
      client-package.json, SesionContext, App.tsx, CLAUDE.md).
- [ ] Confirmar login E2E con `fjavieraf2@gmail.com` en el dominio publicado.
- [ ] Recrear los otros superadmins si hacen falta — ya se puede desde la
      app: menú Usuarios (ADMIN) invita por correo y asigna rol/almacén.
- [ ] Importar muestra del Excel (~40 renglones) — conseguir
      `Inventario_Auditoria.xlsx`.
- [ ] Confirmar el dominio en CORS/Authorized Domains de Authentication.
- [ ] Crear ENCARGADO(s)/TECNICO(s) cuando se definan — desde el menú
      Usuarios de la app.
- [ ] Probar el flujo de invitación E2E (correo llega, fija contraseña,
      entra con el rol correcto).
- [ ] Probar endpoints con token real (curl/Postman).
- [ ] Probar idempotencia (repetir POST con mismo `uuid_cliente`), permisos
      (TECNICO → PATCH almacén = 403) y paginación con volumen realista.
- [ ] Escaneo en teléfono con etiquetas reales (¿qué trae el código de
      fábrica?) y prueba completa desde el S26 Ultra.
- [ ] Menor: advertencia al cerrar sesión con cola local sin sincronizar.

**No construir en esta versión:** traslados con doble aprobación · fotos ·
comodato · offline · catálogos editables · APK nativo.
