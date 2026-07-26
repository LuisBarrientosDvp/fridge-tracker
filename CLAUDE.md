# Fridge Tracker — documento único del proyecto

Sistema de trazabilidad de refrigeradores para una empresa que renta equipo de
frío con publicidad de distintas marcas a puntos de venta (tiendas, changarros,
negocios) en la Comarca Lagunera.

**Fase actual: fullstack sobre Zoho Catalyst.** Este es el único documento del
proyecto: fusiona la especificación v3 (`fridgetracker.md`), el `CLAUDE.md` del
mockup de mi colega (`fridge-tracker-master`), el README del cliente y el
checklist de construcción. Índice:

- **Parte I — Contexto y arquitectura**: estructura, plataforma, reglas no
  negociables, gotchas, convenciones
- **Parte II — Especificación v3** (autoritativa): modelo de datos, endpoints,
  flujos, roles, datos semilla
- **Parte III — Cómo correr, probar y deployar** el cliente
- **Parte IV — Checklist**: todo lo que falta construir, en orden

---

# Parte I — Contexto y arquitectura

## Estructura del proyecto (raíz Catalyst)

```
PACNOR DEMO/
├── catalyst.json        # Config del CLI — cliente = react-app con plugin React. NO editar a mano
├── .catalystrc          # Identidad del proyecto (id 33866000000045392, "DEMO",
│                        #   dominio demo-890811559.development). NO editar / NO commitear
├── functions/           # Vacío — aquí va la Advanced I/O Function (ver Parte IV)
├── react-app/           # Cliente web: mockup portado a CRA/Catalyst (fuente de verdad)
└── CLAUDE.md            # Este archivo (único documento)
```

- Proyecto Catalyst: **DEMO** (`33866000000045392`), DC US, entorno Development
  `890811559`, timezone America/Mexico_City.
- URL de desarrollo: `https://demo-890811559.development.catalystserverless.com`
- Hosting del frontend: **Web Client Hosting** (legacy) con
  `zcatalyst-cli-plugin-react`. La spec contempla migrar a Slate después; el
  mecanismo de auth es el mismo si frontend y backend viven en el mismo proyecto.

## Plataforma

| Aspecto | Decisión |
|---|---|
| Backend | Zoho Catalyst — Data Store, **una** Advanced I/O Function (Node.js/Express), Authentication |
| Frontend | React + TypeScript como PWA. Portado del mockup Vite al build CRA de Catalyst |
| Hosting | Web Client Hosting ahora; Slate como destino posible |
| Dispositivo objetivo | Samsung S26 Ultra, Chrome para Android |
| Archivos | Ninguno en esta versión (sin Stratus). El QR se genera en el cliente |

### Por qué PWA y no APK nativo

Un solo código sirve al técnico en Android y al administrador en escritorio. El
equipo domina React, no Android nativo. La PWA se actualiza sola al abrirla,
sin reinstalar en cada teléfono. Las capacidades necesarias (cámara, GPS, NFC,
almacenamiento) existen en Chrome Android. Si más adelante hace falta un APK
instalable, la ruta es envolver la misma PWA con Capacitor (5-8 días), no
reescribir en nativo (30-50 días). La decisión de PWA no cierra la puerta a un
APK después; empezar en nativo sí cerraría la puerta a la web.

### Autenticación

Frontend y backend deben vivir en el **mismo proyecto de Catalyst** — es el
requisito del que depende todo el mecanismo. El cliente obtiene el token con
`catalyst.auth.generateAuthToken()`, lo lee de `access_token` y lo envía en el
header `Authorization` de cada llamada al backend. El token es válido **una
hora**, por lo que se obtiene justo antes de llamar y nunca se guarda. El
dominio del cliente (y `*.onslate.com` si se migra a Slate) debe darse de alta
en el CORS del componente Authentication.

**No usar API Gateway** para esto. Su autenticación es de máquina a máquina con
API key, que en una PWA queda expuesta al público y no identifica qué usuario
hizo cada cambio. Además, al habilitarlo se deshabilitan las Security Rules y
las funciones quedan inaccesibles hasta crear APIs para cada una. API Gateway
tiene sentido solo si un tercero externo (un ERP) necesita consultar el
inventario más adelante.

### Preparación para offline (futuro)

Esta versión es en línea, pero el esquema ya la prepara. Cada movimiento lleva
un `uuid_cliente` generado en el dispositivo, que sirve de clave de
idempotencia: si una sincronización se reintenta, el backend reconoce el UUID
y no duplica. Cuando se agregue el modo offline, la cola guardará eventos sin
credenciales y el token se adjuntará solo al sincronizar. Las fotos quedan
explícitamente fuera de la cola offline por su peso; solo el cambio de estatus
(un JSON pequeño) se encola.

## Decisiones del mockup SUPERADAS por la spec v3

El mockup se construyó antes de la spec v3. Estas piezas del código heredado
**cambian** — no las tomes como referencia de producto:

1. **Estatus:** ✅ refactor hecho (2026-07-26). `src/types/estatus.ts` ya trae
   los **dos ejes** de la v3 (Parte II §3) con etiquetas y colores; el
   catálogo viejo de 10 estatus desapareció.
2. **Auth:** el "JWT propio, no el SDK de Catalyst" del mockup era por el
   origen `capacitor://localhost` de la fase nativa. La PWA en hosting del
   mismo proyecto **sí usa el SDK de Catalyst** (`generateAuthToken`).
3. **Offline:** esta versión es **en línea**. La cola Dexie del mockup queda
   como preparación; el modo offline completo es futuro.
4. **Llave del equipo:** el mockup asumía `numeroSerie` único. La v3 reconoce
   seriales duplicados/ilegibles: la unicidad vive en `CodigoEquipo.codigo`
   (N códigos por equipo) y `Refrigerador.serial` es informativo.
5. **Comodato/tránsito (Bloque 2 del mockup):** fuera de esta versión, igual
   que traslados con doble aprobación (tablas listas, sin interfaz), fotos y
   catálogos editables.

## Reglas de arquitectura no negociables (heredadas del mockup, vigentes)

1. **Capa de servicios abstraída.** Todo acceso a capacidades del dispositivo
   pasa por `src/services/` (interfaz + `.web.ts`, elegidas en `index.ts`).
   Una llamada directa a `navigator.geolocation` fuera de `location.web.ts`
   está mal. Es lo que permitirá la fase nativa (Capacitor) sin reescribir.
2. **Encolar eventos, no estados.** El estatus vigente se deriva del historial
   (`Movimiento` es append-only). Si guardas estados, el último en sincronizar
   gana y se pierde el historial — que es el producto que se está vendiendo.
3. **El UUID del cliente es la llave de idempotencia.** `crypto.randomUUID()`
   en el dispositivo, nunca en el servidor. Sin esto, cualquier reintento de
   red duplica registros, y los reintentos van a ser constantes en ruta.
4. **Dos marcas de tiempo, y `fecha_evento` manda.** `fecha_evento` = reloj del
   dispositivo, ordena la lógica de negocio. `fecha_registro` = reloj del
   servidor, solo auditoría. Resolver conflictos por timestamp del servidor
   está mal: ese timestamp es cuándo sincronizó, no cuándo ocurrió.
5. **Captura manual siempre disponible.** Toda pantalla de escaneo lleva botón
   para teclear el código a mano (`capturaManual: true`). Los códigos 1D
   fallan con etiquetas viejas, grasosas o descoloridas.
6. **Contador de pendientes siempre visible** y advertencia al cerrar sesión
   con cola sin sincronizar. Es la única defensa contra "el operador
   desinstaló la app con 40 escaneos encolados".
7. **Fotos (fase futura): comprimir antes de encolar, cola separada** de menor
   prioridad que los eventos (canvas ~1200px, JPEG 0.7 → ~150-250 KB).
8. **Permisos validados en el backend**, no solo ocultando botones en la UI.

## Gotchas conocidos

**Frontend / dispositivo:**
- `BarcodeDetector` no existe en Safari/iOS (todos los navegadores de iOS son
  WebKit). ✅ Resuelto (2026-07-26): `scanner.web.ts` usa el ponyfill
  [`barcode-detector`](https://www.npmjs.com/package/barcode-detector)
  (zxing-wasm) cuando la API nativa falta, así que **iPhone/iPad y escritorio
  también escanean**. La captura manual sigue siempre disponible (regla 5).
  Nota: el ponyfill descarga su .wasm de jsDelivr la primera vez — requiere
  red en el primer escaneo iOS.
- WebKit niega la geolocalización con certificado autofirmado: en dev los
  eventos de iPhone van sin GPS. Con certificado válido (producción) no aplica.
- HTTPS obligatorio en dev: `getUserMedia` exige contexto seguro
  (`HTTPS=true` en `react-app/.env`).
- No está verificado que el código de fábrica contenga el número de serie
  (puede ser modelo, lote o UPC). Pendiente de validar con etiquetas reales —
  por eso la pantalla de escaneo muestra la cadena cruda y el formato.
- Los códigos 1D son mucho más difíciles de leer que los QR (sin patrones de
  localización ni corrección de errores).
- `sincronizado` en Dexie es `0 | 1`, no boolean (IndexedDB no indexa booleanos).

**Catalyst:**
- El dominio del cliente debe estar en el **CORS / Authorized Domains** del
  componente Authentication, o el login y `generateAuthToken` fallan.
- El **ZAID es distinto en Development y Production** — nunca hardcodear;
  es la causa #1 de fallas de auth al promover de entorno.
- ZCQL limita filas por respuesta → **paginación obligatoria** en todo endpoint
  de listado desde el diseño. Probar con volumen realista (hay ~9,000 equipos
  reales esperando la importación).
- Data Store no tiene PostGIS: lat/lng como Double, distancias con haversine
  en la función.
- Antes de deployar a Production cada servicio necesita su clic en
  "Start Exploring" en la consola, y Production requiere billing.
- Catalyst se factura aparte de Zoho One/CRM.

**Fase nativa (futuro, no aplica hoy):**
- ML Kit descarga su módulo vía Google Play Services la primera vez; verificar
  con `isGoogleBarcodeScannerModuleAvailable()` o empaquetar el modelo.
- El SDK de Catalyst no encaja con el origen `capacitor://localhost` (cookies
  cross-origin) — de ahí vendría un JWT propio en esa fase.
- `@capacitor/camera` 8.1.0 deprecó `getPhoto`/`pickImages`; ignorar
  tutoriales viejos.

**Build (post-fusión, 2026-07-26):**
- El build lo hace `zcatalyst-cli-plugin-react` (webpack estilo CRA), no Vite.
  Tailwind es **v3** en modo PostCSS (el plugin lo activa al ver
  `tailwind.config.js`); no usar sintaxis v4 (`@import 'tailwindcss'`).
- TypeScript fijado en **4.9** (peer range de react-scripts 5). Babel solo
  quita tipos; el chequeo estricto vive en `tsconfig.json`.

## Convenciones de código

- **Dominio en español, técnica en inglés.** `numeroSerie`, `puntoVenta`,
  `estatusUbicacion` — términos de negocio sin traducción limpia. Los nombres
  técnicos (`fetchInventory`, `useDebounce`) en inglés. No mezclar dentro de
  un mismo identificador.
- **TypeScript estricto.** Tipos explícitos para eventos, estatus y
  transiciones. Los catálogos de estatus son uniones de literales, no `string`.
- Mobile-first: operador de bodega con una mano, con guantes, con mala luz.
  Targets táctiles grandes, contraste alto, nada de hovers.
- Sin librerías de UI pesadas. Tailwind y componentes propios.

## Lo que NO hay que hacer

- No instalar plugins de Capacitor en esta fase.
- No llamar APIs del navegador fuera de la capa de servicios.
- No guardar estados en la cola; solo eventos.
- No generar el UUID de eventos en el servidor.
- No usar API Gateway para la PWA.
- No guardar el token de auth (dura 1 h; se pide justo antes de llamar).
- No crear las tablas a mano en la consola: por CLI/SDK/MCP desde el esquema
  de la Parte II §5, para que sea reproducible.
- No construir traslados con doble aprobación, fotos, comodato ni modo
  offline en esta versión.
- Nunca pasar credenciales, API keys ni tokens por chat: el CLI de Catalyst ya
  está autenticado en la máquina del desarrollador.

## Preguntas abiertas con el cliente

No inventes respuestas ni construyas suposiciones sobre estos puntos:

1. ¿Renta con publicidad o comodato? Si hay renta, falta toda la capa
   comercial: tarifa, vigencia, facturación, renovación.
2. ¿El patrocinador cambia durante la vida del equipo? Si la publicidad rota,
   es un atributo con historia y falta el flujo de recambio de vinil.
3. ¿Cómo regresan los equipos? No existe flujo de retiro/recolección; el
   estatus de baja existe sin proceso que lleve a él.
4. ¿Qué teléfonos usan operadores y choferes? Define si iOS entra al alcance.
5. Volumen: cuántos equipos, almacenes, puntos de venta y usuarios.
6. ¿Quién es dueño de los teléfonos? Afecta sincronización y sesiones.
7. ¿Un encargado puede cubrir varios almacenes? (el modelo ya lo permite vía
   `AlmacenEncargado`, con `encargado_principal_id` en `Almacen` para pantalla)
8. ¿`Modelo` como catálogo dependiente de marca o texto con autocompletado?
   Propuesta: autocompletado contra `Catalogo`.

---

# Parte II — Especificación v3 (autoritativa)

Ante cualquier conflicto con el resto del documento, manda esta parte.

## §2. Alcance de esta versión

**Incluido:** login (técnico/admin); escaneo de código de barras o QR con la
cámara; resolución del código a un equipo; alta en campo de un equipo no
registrado; cambio de estatus de ubicación y de condición; creación y
reutilización de ubicaciones; generación y descarga de QR en PNG; historial
completo de movimientos; tabla de administración en escritorio; cambio de
almacén solo por admin y directo.

**Explícitamente fuera:** solicitudes de traslado con doble aprobación (las
tablas quedan listas, la interfaz no se construye); fotos; comodato; operación
sin conexión; catálogos editables desde la interfaz.

## §3. Los dos ejes de estatus

El inventario real demuestra que "dónde está" y "en qué condición está" son
independientes. Un refrigerador puede estar colocado en una tienda **y** estar
marcado como chatarra. Se modelan en dos campos separados. Mezclarlos en uno
solo perdería la mitad de la información desde el primer registro.

### Estatus de ubicación (`estatus_ubicacion`)

| Código | Significado | Campo requerido |
|---|---|---|
| `EN_ALMACEN` | En un almacén | ninguno |
| `EN_UBICACION` | Colocado en punto de venta | `lugar_actual_id` (tipo `PUNTO_VENTA`) |
| `EN_REPARACION` | En reparación | ver abajo |

Para `EN_REPARACION`:
- Interna en su propio almacén: `reparacion_tipo = INTERNA`, sin más campos.
- Interna en otro almacén: `reparacion_tipo = INTERNA` + `almacen_reparacion_id`.
- Externa: `reparacion_tipo = EXTERNA` + `lugar_actual_id` (tipo `TALLER`).

### Estatus de condición (`estatus_condicion`)

| Código | Significado |
|---|---|
| `OPERATIVO` | Funcional (estado por defecto) |
| `MANTENIMIENTO` | Requiere o está en mantenimiento |
| `REFURBISH` | Para reacondicionar |
| `CHATARRA` | Baja / desecho |

Valores derivados del inventario real (CHATARRA, PARA REFURBISH,
MANTENIMIENTO) más OPERATIVO por defecto. **Ambos ejes se validan en el
backend.**

## §4. Identificadores: un equipo tiene varios códigos

El inventario real trae dos identificadores por equipo: `Series` (serial de
placa, largo) y `Activo` (número de activo, más corto). El serial no siempre
es legible ni único — los datos reales contienen duplicados y valores "N/D".
Por eso:

- `Refrigerador.serial` **no lleva índice único**; es un atributo informativo.
- La unicidad vive en `CodigoEquipo.codigo`, con índice único global.
- Un equipo puede tener N códigos (serial de placa, número de activo, QR
  generado); cualquiera lo resuelve a la misma ficha.
- Un equipo sin código legible se puede registrar igual y se le asocia un
  código después, al etiquetarlo.
- Físicamente un refri trae varios códigos de barras encima (placa, eficiencia
  energética, número de parte, logística). La tabla `CodigoEquipo` evita que
  escanear el equivocado rompa la correspondencia.

## §5. Modelo de datos — 9 tablas

Tipos expresados en términos de Data Store de Catalyst. **Crear por CLI/SDK
desde este esquema, no a mano.** El CP siempre va como **Text, nunca Int**
(los que empiezan con cero pierden el dígito). Todas las direcciones son
**opcionales** salvo el nombre; el técnico en campo no siempre tiene la
dirección completa.

Nota de implementación: los índices únicos **compuestos** (`Lugar` tipo +
nombre_normalizado; `AlmacenEncargado` almacen + usuario) no existen en Data
Store → se garantizan en el backend.

### §5.1 `Almacen`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `nombre` | Text (100) | Sí | "Almacén Torreón" |
| `codigo_interno` | Text (20) | No | Clave corta (TRC, GP, LER) |
| `calle` | Text (200) | No | |
| `numero_ext` | Text (20) | No | |
| `numero_int` | Text (20) | No | |
| `colonia` | Text (150) | No | |
| `municipio` | Text (150) | No | |
| `estado` | Text (100) | No | Coahuila, Durango |
| `cp` | Text (10) | No | Text, no número |
| `referencia` | Text (300) | No | |
| `lat` | Double | No | |
| `lng` | Double | No | |
| `telefono` | Text (30) | No | |
| `encargado_principal_id` | BigInt | No | ROWID de `Usuario`, el que aparece en pantalla |
| `activo` | Boolean | Sí | default true |

### §5.2 `Lugar`

Puntos de venta y talleres externos, unificados. Misma estructura de dirección
que el almacén.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo` | Text (20) | Sí | `PUNTO_VENTA` \| `TALLER` |
| `nombre` | Text (200) | Sí | Como lo escribe el técnico |
| `nombre_normalizado` | Text (200) | Sí | Minúsculas sin acentos. **Índice único con `tipo`** (en backend) |
| `calle` | Text (200) | No | |
| `numero_ext` | Text (20) | No | |
| `numero_int` | Text (20) | No | |
| `colonia` | Text (150) | No | |
| `municipio` | Text (150) | No | |
| `estado` | Text (100) | No | |
| `cp` | Text (10) | No | |
| `referencia` | Text (300) | No | |
| `lat` | Double | No | GPS al crear |
| `lng` | Double | No | |
| `contacto_nombre` | Text (120) | No | Encargado de la tienda/taller |
| `contacto_telefono` | Text (30) | No | |
| `creado_por` | Text (60) | Sí | ID Catalyst |
| `fecha_creacion` | DateTime | Sí | |

**Deduplicación:** al escribir el nombre, el cliente busca contra
`nombre_normalizado` con coincidencia parcial y muestra resultados. "Crear
nueva ubicación" se habilita solo después de ver la lista. Si la normalización
colisiona con una existente, el backend devuelve la existente en vez de
duplicar.

### §5.3 `Usuario`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `catalyst_user_id` | Text (60) | Sí | ID de Catalyst Auth. **Índice único** |
| `nombre` | Text (120) | Sí | |
| `correo` | Text (150) | No | |
| `telefono` | Text (30) | No | |
| `rol` | Text (20) | Sí | `TECNICO` \| `ENCARGADO` \| `ADMIN` |
| `almacen_id` | BigInt | No | Almacén base |
| `activo` | Boolean | Sí | default true |

### §5.4 `AlmacenEncargado`

Asignación N a N entre almacenes y encargados. Define quién puede aprobar
traslados en cada almacén. Se crea ahora porque la función de traslado
(futura) pregunta exactamente esto.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `almacen_id` | BigInt | Sí | **Índice único con `usuario_id`** (en backend) |
| `usuario_id` | BigInt | Sí | |
| `puede_aprobar_traslados` | Boolean | Sí | default true |
| `fecha_asignacion` | DateTime | Sí | |

### §5.5 `Refrigerador`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `serial` | Text (100) | No | Placa. **Sin índice único** |
| `num_activo` | Text (60) | No | Columna "Activo" del Excel |
| `marca` | Text (60) | Sí | |
| `modelo` | Text (60) | No | |
| `equipo_tipo` | Text (60) | Sí | Refrigerador, Máq. hielo, Cám. fría |
| `anio` | Int | No | |
| `cerveza` | Text (60) | No | Corona, Modelo… |
| `almacen_id` | BigInt | Sí | Almacén casa (estable) |
| `estatus_ubicacion` | Text (20) | Sí | `EN_ALMACEN` \| `EN_UBICACION` \| `EN_REPARACION` |
| `estatus_condicion` | Text (20) | Sí | `OPERATIVO` \| `MANTENIMIENTO` \| `REFURBISH` \| `CHATARRA` |
| `lugar_actual_id` | BigInt | No | FK `Lugar` |
| `reparacion_tipo` | Text (10) | No | `INTERNA` \| `EXTERNA` |
| `almacen_reparacion_id` | BigInt | No | Si se repara en otro almacén |
| `origen_registro` | Text (20) | Sí | `IMPORTACION` \| `CAMPO` |
| `registrado_por` | Text (60) | Sí | Usuario |
| `fecha_registro` | DateTime | Sí | Cuándo se creó el renglón en el sistema |
| `fecha_ingreso_real` | DateTime | No | Cuándo entró de verdad a operación (puede ser anterior) |

### §5.6 `CodigoEquipo`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `refrigerador_id` | BigInt | Sí | FK |
| `codigo` | Text (200) | Sí | **Índice único global** |
| `formato` | Text (20) | Sí | `code_128`, `qr_code`, `activo`, etc. |
| `es_principal` | Boolean | Sí | El que se considera el serial |
| `fecha_alta` | DateTime | Sí | |

Al dar de alta un equipo se crea el código principal automáticamente si hay
serial. El número de activo entra como segundo código con `formato = activo`.

### §5.7 `Movimiento`

Historial completo. **Append-only:** nunca se edita ni se borra. Todo cambio
de estatus, ubicación, condición o almacén escribe un renglón aquí. El estatus
actual del refri es un valor denormalizado que se recalcula a partir del
último movimiento.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `refrigerador_id` | BigInt | Sí | FK |
| `uuid_cliente` | Text (40) | Sí | **Índice único.** Idempotencia |
| `tipo_evento` | Text (30) | Sí | `ALTA`\|`CAMBIO_UBICACION`\|`CAMBIO_CONDICION`\|`TRASLADO`\|`REPARACION` |
| `estatus_ubicacion_ant` | Text (20) | No | |
| `estatus_ubicacion_nuevo` | Text (20) | No | |
| `estatus_condicion_ant` | Text (20) | No | |
| `estatus_condicion_nuevo` | Text (20) | No | |
| `lugar_id` | BigInt | No | |
| `almacen_anterior_id` | BigInt | No | |
| `almacen_nuevo_id` | BigInt | No | |
| `reparacion_tipo` | Text (10) | No | |
| `nota` | Text (500) | No | |
| `usuario_id` | Text (60) | Sí | Quién hizo el movimiento |
| `fecha_evento` | DateTime | Sí | Cuándo ocurrió (generado en el cliente) |
| `fecha_registro` | DateTime | Sí | Cuándo llegó al servidor |
| `lat` | Double | No | |
| `lng` | Double | No | |

### §5.8 `SolicitudTraslado`

Tabla lista, **sin interfaz en esta versión**. Se define ahora para no migrar
después.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `refrigerador_id` | BigInt | Sí | |
| `almacen_origen_id` | BigInt | Sí | |
| `almacen_destino_id` | BigInt | Sí | |
| `solicitado_por` | Text (60) | Sí | |
| `estado` | Text (20) | Sí | `PENDIENTE`\|`APROBADA`\|`RECHAZADA`\|`CANCELADA` |
| `aprobado_origen_por` | Text (60) | No | |
| `aprobado_destino_por` | Text (60) | No | |
| `nota` | Text (500) | No | |
| `fecha_solicitud` | DateTime | Sí | |
| `fecha_resolucion` | DateTime | No | |

### §5.9 `Catalogo`

Para que marca, modelo, tipo y cerveza no sean texto libre. Una sola tabla
para los cuatro.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo_catalogo` | Text (20) | Sí | `MARCA`\|`MODELO`\|`EQUIPO_TIPO`\|`CERVEZA` |
| `valor` | Text (80) | Sí | |
| `activo` | Boolean | Sí | |

## §6. Endpoints

Una sola Advanced I/O Function en Node.js con rutas Express.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/codigos/:codigo` | Resuelve un código escaneado. 200 con equipo o 404 |
| POST | `/equipos` | Alta. `almacen_id` = el del usuario. Crea el código principal |
| GET | `/equipos` | Lista con filtros de almacén, estatus, búsqueda |
| GET | `/equipos/:id` | Ficha con su historial de movimientos |
| POST | `/equipos/:id/movimientos` | Cambio de ubicación o condición. Valida reglas §3. Idempotente por `uuid_cliente` |
| PATCH | `/equipos/:id/almacen` | Cambio de almacén. **Solo rol ADMIN** |
| GET | `/lugares?tipo=&q=` | Búsqueda contra `nombre_normalizado` |
| POST | `/lugares` | Crea lugar. Devuelve el existente si la normalización colisiona |
| GET | `/almacenes` | Catálogo de almacenes |
| GET | `/catalogos?tipo=` | Valores de marca/modelo/tipo/cerveza |

**Idempotencia:** si el `uuid_cliente` de un movimiento ya existe, devolver
200 con el existente en vez de crear otro. Esto hará funcionar la cola offline
futura sin cambiar el backend.

**Permisos validados en el backend, no solo ocultando botones en la interfaz.**

## §7. Flujo de escaneo

```
Técnico abre "Escanear"
  ↓
BarcodeDetector lee un código
  ↓
GET /codigos/:codigo
  ├─ 200 → Abre la ficha del equipo
  │         ↓  elige acción
  │         ├─ Cambiar ubicación
  │         │    ├─ EN_ALMACEN     → guarda directo
  │         │    ├─ EN_UBICACION   → busca o crea Lugar (PUNTO_VENTA)
  │         │    └─ EN_REPARACION  → interna (mismo/otro almacén) o externa + Lugar (TALLER)
  │         └─ Cambiar condición   → OPERATIVO / MANTENIMIENTO / REFURBISH / CHATARRA
  │         ↓
  │       POST /equipos/:id/movimientos
  │
  └─ 404 → "Equipo no registrado"
            ↓
          Formulario de alta con el código precargado en `serial` (editable)
          almacen_id = almacén del usuario · estatus inicial EN_ALMACEN + OPERATIVO
            ↓
          POST /equipos
```

### Formatos de código aceptados

```javascript
const detector = new BarcodeDetector({
  formats: ['code_128','code_39','code_93','ean_13','ean_8',
            'upc_a','itf','data_matrix','qr_code']
});
```

`BarcodeDetector` está disponible en Chrome para Android (objetivo: S26
Ultra). Para escritorio o navegadores sin soporte, usar `@zxing/browser` como
respaldo detrás de una detección de capacidad.

## §8. Generación del QR

Cliente puro, sin backend ni almacenamiento. Librería `qrcode` (npm).
**Contenido del QR: el valor de `serial`**, no el ROWID. Se pinta en
`<canvas>`, botón "Descargar PNG" con `canvas.toDataURL('image/png')`. Tamaño
512×512 px con margen, corrección de errores nivel M.

Razón de codificar el serial: el QR y el código de barras de fábrica entran
por el mismo resolvedor (`GET /codigos/:codigo`), un solo camino de código, y
las etiquetas impresas siguen sirviendo si la base se reimporta y los ROWID
cambian.

## §9. Roles y permisos

| Acción | TECNICO | ENCARGADO | ADMIN |
|---|---|---|---|
| Escanear y ver ficha | Sí | Sí | Sí |
| Cambiar estatus (ubicación/condición) | Sí | Sí | Sí |
| Dar de alta equipo en campo | Sí | Sí | Sí |
| Crear ubicación | Sí | Sí | Sí |
| Cambiar almacén del equipo | No | No | Sí |
| Ver tabla de administración | No | Solo su almacén | Todos |

## §10. Datos semilla

**Almacenes:** Torreón, Gómez Palacio, Lerdo (con lat/lng aproximados de cada
ciudad y direcciones de ejemplo).

**Catálogo — marcas:** Criotec, Froster, Hussmann, Imbera, Metalfrio, NSF.
**Catálogo — tipos:** Refrigerador, Máq. hielo, Cám. fría.
**Catálogo — cervezas:** Corona, Modelo, Budlight, Michelob, Modelorama.

**Lugares `PUNTO_VENTA`:** Abarrotes La Esquina (Torreón), Licorería El Roble
(Torreón), Súper Ahorro Centro (Gómez Palacio), Tienda Doña Chuy (Gómez
Palacio), Minisúper Las Palmas (Lerdo), Depósito San Isidro (Lerdo).

**Lugares `TALLER`:** Refrigeración Industrial del Norte (Torreón), Servicios
Térmicos Lerdo (Lerdo).

**Equipos:** importar ~40 renglones del Excel real
(`Inventario_Auditoria.xlsx`, hoja TRC) como muestra, repartidos entre los
tres almacenes.

**Mapeo de columnas del Excel:** `Series`→`serial`, `Activo`→`num_activo`,
`Equipo`→`equipo_tipo`, `Marca`→`marca`, `Modelo`→`modelo`, `Año`→`anio`,
`Estatus`→`estatus_condicion` (CHATARRA→CHATARRA, PARA REFURBISH→REFURBISH,
MANTENIMIENTO→MANTENIMIENTO). `estatus_ubicacion`→`EN_ALMACEN` por defecto.
`origen_registro`→`IMPORTACION`.

**Limpieza en la importación:** deduplicar seriales repetidos; saltar o
importar sin código los renglones con serial "N/D" o de longitud < 8;
normalizar la marca contra el catálogo (el Excel tiene "IMBERA" e "Imbera" en
hojas distintas). Esta misma lógica servirá al importar los ~9,000 equipos
reales.

**Usuarios:** un TECNICO en Torreón y un ADMIN. Crear en Authentication al
llegar al login.

## §11. Orden de construcción sugerido

1. Esquema de las 9 tablas + datos semilla + importación de la muestra del
   Excel. Verificar en consola.
2. Advanced I/O Function con los endpoints. Probar con curl/Postman.
3. Resolución de escaneo (`GET /codigos/:codigo`) contra datos reales.
4. Cliente: login + capa `api.ts` centralizada con el token.
5. Pantalla de escaneo + ficha + cambio de estatus.
6. Alta en campo.
7. Generación de QR.
8. Tabla de administración.

Cada paso verificable antes del siguiente. El error típico es pedir la app
completa de un tiro y terminar depurando tres capas sin saber cuál falla.

---

# Parte III — Cómo correr, probar y deployar el cliente

`react-app/` es la **fusión** del mockup funcional v1 (construido con Vite por
mi colega) con el scaffold de Web Client Hosting generado por `catalyst init`
(Create React App). El código fuente del mockup se portó completo a `src/`;
el build ahora lo hace el plugin de Catalyst (`zcatalyst-cli-plugin-react`,
basado en webpack/CRA), ya no Vite.

## Qué cambió respecto al mockup de Vite

| Pieza | Mockup (Vite) | Ahora (Catalyst/CRA) |
|---|---|---|
| Build | Vite 8 | webpack del plugin `zcatalyst-cli-plugin-react` / `react-scripts` |
| Entry | `index.html` + `src/main.tsx` | `public/index.html` + `src/index.tsx` |
| Tailwind | v4 (`@import 'tailwindcss'` vía plugin de Vite) | **v3** (`@tailwind base/components/utilities` + `tailwind.config.js`) |
| TypeScript | 7.x | **4.9** (límite de react-scripts 5; babel solo quita tipos) |
| HTTPS en dev | `@vitejs/plugin-basic-ssl` | `HTTPS=true` en `.env` (CRA genera certificado autofirmado) |
| Deploy | n/a | `catalyst deploy` desde la raíz del proyecto |

Todo lo demás (tipos, servicios, hooks, componentes, páginas) se copió sin
cambios. La capa de servicios y sus reglas siguen intactas.

## Requisitos

- Node.js 22+
- CLI de Catalyst (`npm i -g zcatalyst-cli`) con sesión iniciada para deploy
- Un teléfono Android con Chrome en la misma red Wi-Fi que tu máquina
  (iOS **no** puede escanear: ningún navegador de iOS implementa
  `BarcodeDetector`; la app degrada a captura manual)

## Instalar y correr

```bash
cd react-app
npm install
npm start          # dev server CRA con HTTPS (ver react-app/.env)
```

También puedes servir vía Catalyst desde la raíz del proyecto: `catalyst serve`

## Probar desde el teléfono

1. Teléfono y máquina en la **misma red Wi-Fi**.
2. Abre en Chrome del teléfono `https://<tu-ip-local>:3000/`.
3. Chrome va a advertir por el certificado autofirmado: **Configuración
   avanzada → Continuar de todos modos**.
4. Acepta el permiso de cámara y apunta a cualquier código de barras.

Cada lectura vibra, pinta un flash verde y muestra **la cadena decodificada
cruda y el formato detectado** (`code_128`, `ean_13`, `qr_code`…). Sirve para
descubrir qué traen realmente las etiquetas de fábrica (¿número de serie?,
¿modelo?, ¿UPC?) — pendiente de validar con etiquetas reales.

El contador "N por sincronizar" (arriba a la derecha) es un botón: lleva a
`/debug`, que lista la cola de eventos completa (uuid, tipo, serie, formato,
fecha, GPS, captura manual).

### Si el teléfono no carga la página

- **HTTPS es obligatorio**: `getUserMedia` (cámara) solo funciona en contexto
  seguro; `http://<ip>` nunca va a pedir permiso de cámara.
- Windows Firewall puede estar bloqueando a Node en redes privadas.
- Si hay VPN en la máquina, puede bloquear conexiones entrantes de la LAN.
- Plan B sin red: `adb reverse tcp:3000 tcp:3000` por USB y abre
  `https://localhost:3000` en el teléfono.

### Qué esperar en un iPhone

La página carga y la cola funciona, pero **no hay escaneo con cámara**; la app
cae a captura manual — verificado en un iPhone 17 el 2026-07-25. WebKit además
niega la geolocalización con certificado autofirmado, así que en dev los
eventos de iPhone van sin GPS.

## Deploy a Catalyst (Web Client Hosting)

Desde la **raíz** del proyecto (donde vive `catalyst.json`):

```bash
catalyst deploy
```

El plugin de React construye y sube el cliente. URL de desarrollo:
`https://demo-890811559.development.catalystserverless.com`

## Estructura del cliente (app completa, 2026-07-26)

```
react-app/src/
├── types/
│   ├── estatus.ts       Dos ejes de estatus (uniones de literales) + etiquetas + colores
│   ├── api.ts           Formas de los datos del backend (Equipo, Lugar, Movimiento…)
│   ├── evento.ts        Evento de la cola local (legado del mockup, solo /debug)
│   ├── catalyst.d.ts    Tipos mínimos de window.catalyst (Web SDK)
│   └── barcode-detector.d.ts  Tipos de la API BarcodeDetector
├── services/            ÚNICA puerta a dispositivo Y red (regla 1)
│   ├── index.ts         Punto de importación para toda la app
│   ├── api.ts           TODA llamada al backend pasa por aquí (token por llamada)
│   ├── auth.ts/.web.ts  Sesión Catalyst: login, logout, encabezados de auth
│   ├── scanner.ts/.web.ts  BarcodeDetector nativo o ponyfill zxing-wasm (iOS)
│   ├── location.ts/.web.ts GPS best-effort · haptics.ts/.web.ts vibración
│   ├── storage.ts/.web.ts + db.ts  Cola Dexie (legado, solo /debug)
│   └── camera.ts/.web.ts   Stub (fotos: fase futura)
├── context/
│   └── SesionContext.tsx  Estado global de sesión: cargando → login → usuario+rol
├── components/
│   ├── ui.tsx             Insignias de estatus, cabecera, tarjeta de equipo…
│   ├── ListaEquipos.tsx   Lista con filtros/búsqueda/totales/paginación
│   ├── BuscadorLugar.tsx  Búsqueda normalizada + crear con GPS silencioso
│   └── CapturaManual.tsx  Teclear código a mano (regla 5)
└── pages/
    ├── LoginPage.tsx      PRIMERA pantalla: widget de Catalyst Auth
    ├── MenuPage.tsx       Menú por rol (§9 + roles de producto)
    ├── EscaneoPage.tsx    Cámara → GET /codigos/:codigo → ficha o alta
    ├── FichaEquipoPage.tsx  Ficha + cambios de estatus + QR + historial
    ├── AltaEquipoPage.tsx   Alta en campo con catálogos
    ├── ReportesPage.tsx     Global, solo ADMIN
    ├── AlmacenPage.tsx      Mi almacén (ENCARGADO/ADMIN)
    └── DebugColaPage.tsx    Inspección de la cola local (legado)
```

Regla de dependencias: `pages` y `components` importan **solo** de
`src/services` (el index), nunca una implementación `.web.ts`, un fetch ni
una API del navegador directa.

### Mapa de roles del producto

| Producto dice | En el sistema | Menú |
|---|---|---|
| Superadmin | `ADMIN` | Escanear · Mi almacén · **Reportes** · cambiar almacén de equipos |
| Encargado de almacén | `ENCARGADO` | Escanear · Mi almacén (solo el suyo) |
| Usuario | `TECNICO` | Solo escanear |

Las rutas se protegen en `App.tsx` y el backend vuelve a validar cada
permiso. Superadmins actuales (rol ADMIN, sin almacén base):
`fjavieraf@gmail.com`, `lbarrientosnajera@gmail.com`, `l.r.v.m2409@gmail.com`.

### Flujo de sesión

1. `index.html` carga el Web SDK (`catalystWebSDK.js` + `/__catalyst/sdk/init.js`
   — este último solo existe hospedado en el dominio del proyecto).
2. `SesionContext` revisa `isUserAuthenticated()` → sin sesión muestra
   `LoginPage` (widget `catalyst.auth.signIn`).
3. Con sesión llama `GET /yo`: si el correo no tiene renglón en `Usuario`
   responde 403 → pantalla "cuenta sin acceso".
4. `services/api.ts` agrega auth a cada llamada: token de
   `generateAuthToken()` si el SDK lo ofrece + cookies same-origin con header
   CSRF (`ZCSRF-TOKEN: csrfParam=<cookie ZD_CSRF_TOKEN>`).

## Decisiones vigentes

- **`ScannerService` es una sesión** (`iniciar(callback)` → `{stream, detener}`).
- **HashRouter** (rutas `#/…`): el hosting sirve bajo `/app/index.html` sin
  rewrites.
- **QR**: librería `qrcode`, contenido = serial, 512 px, corrección M (§8).
- **Escaneo universal**: nativo si existe `BarcodeDetector`, ponyfill
  `barcode-detector` (zxing-wasm) si no — iOS/escritorio escanean.
- **GPS best-effort 5 s** en movimientos, altas y creación de lugares.
- **La cola Dexie del mockup queda como legado** (visible en `/debug`); los
  movimientos van directo a la API. Cuando entre el modo offline (futuro), la
  cola se reconecta usando el mismo `uuid_cliente`.

---

# Parte IV — Checklist de construcción

Todo lo que falta hacer manualmente, en el orden sugerido por la spec (§11).
Marca cada casilla al completarla.

## 0. Git y deploy inicial

- [x] Repo remoto conectado y pusheado:
      `https://github.com/LuisBarrientosDvp/fridge-tracker.git` (master).
- [x] `catalyst deploy` completo (cliente + funciones) — 2026-07-26.
      App: `https://demo-890811559.development.catalystserverless.com/app/index.html`
      API: `https://demo-890811559.development.catalystserverless.com/server/api/`
      Nota: el cliente usa **HashRouter** (rutas `#/` y `#/debug`) porque el
      hosting sirve bajo `/app/index.html` sin rewrites de servidor.

## 1. Data Store — las 9 tablas (Parte II §5) — ✅ HECHO 2026-07-26 vía MCP

- [x] Las 9 tablas creadas con índices únicos (`CodigoEquipo.codigo`,
      `Movimiento.uuid_cliente`, `Usuario.catalyst_user_id`) y defaults.
      IDs: Almacen `33866000000043446`, Lugar `33866000000037369`,
      Usuario `33866000000044450`, AlmacenEncargado `33866000000037728`,
      Refrigerador `33866000000036391`, CodigoEquipo `33866000000040373`,
      Movimiento `33866000000045416`, SolicitudTraslado `33866000000035510`,
      Catalogo `33866000000045809`.
- [x] Permisos: las tablas se tocan **solo** desde la función con scope
      admin; no se habilitó escritura de App User.
- Desviaciones del esquema (aceptadas): varchar tope 255 → `referencia`
  quedó en 255 y `nota` es `text` (10,000); `lat`/`lng` double con 4
  decimales (~11 m, suficiente para el demo).

## 2. Datos semilla e importación (Parte II §10)

- [x] Almacenes: Torreón (TRC, ROWID `33866000000040732`), Gómez Palacio
      (GP, `33866000000040733`), Lerdo (LER, `33866000000040734`).
- [x] Catálogo: 6 marcas, 3 tipos, 5 cervezas (14 renglones).
- [x] Lugares: 6 PUNTO_VENTA + 2 TALLER con `nombre_normalizado`.
- [ ] Script de importación: ~40 renglones de `Inventario_Auditoria.xlsx`
      (hoja TRC) con el mapeo de columnas de §10. **Conseguir el archivo
      Excel** — no está en el repo.
- [ ] Limpieza en la importación: deduplicar seriales, saltar "N/D" o
      longitud < 8, normalizar marcas contra el catálogo ("IMBERA" vs
      "Imbera"). Esta lógica se reutilizará con los ~9,000 equipos reales.

## 3. Authentication

- [ ] "Start Exploring" en Authentication (consola) — confirmar.
- [ ] Confirmar el dominio del cliente en **CORS / Authorized Domains**
      (el dominio `.development.catalystserverless.com`).
- [x] Superadmins creados (2026-07-26) con invitación por correo y renglón
      ADMIN en `Usuario`:
      `fjavieraf@gmail.com` (user_id 33866000000044874),
      `lbarrientosnajera@gmail.com` (33866000000047087),
      `l.r.v.m2409@gmail.com` (33866000000048175).
      **Cada uno debe aceptar la invitación del correo** para fijar su
      contraseña antes de poder entrar.
- [ ] Crear ENCARGADO(s) y TECNICO(s) cuando se definan (mismo procedimiento:
      alta en Authentication + renglón en `Usuario` con rol y almacén base).
- [ ] **No** habilitar API Gateway (Parte I, Autenticación).

## 4. Backend — Advanced I/O Function (Parte II §6) — ✅ DEPLOYADA 2026-07-26

URL: `https://demo-890811559.development.catalystserverless.com/server/api/`

- [x] Función `api` (Advanced I/O, node18, Express) en `functions/api/`.
- [x] Middleware de auth: `getCurrentUser()` del token → busca el renglón en
      `Usuario` → 401 sin token / 403 sin renglón. Data Store con scope admin.
- [x] Los 10 endpoints de la spec + `GET /yo` (usuario autenticado). CORS
      permisivo para el dev server local.
- [x] Smoke test: `GET /almacenes` sin token → 401 `{"error":"No autenticado"}`.
- [ ] Probar todos los endpoints con curl/Postman **con token real** (falta
      crear los usuarios de Auth, sección 3).

## 5. Frontend — ✅ APP COMPLETA CONSTRUIDA Y DEPLOYADA 2026-07-26

- [x] Login como primera pantalla (widget de Catalyst Auth) + compuerta de
      sesión + pantalla "cuenta sin acceso" para 403.
- [x] Menú por rol: ADMIN reportes+almacén+escanear · ENCARGADO
      escanear+almacén · TECNICO solo escanear. Rutas protegidas en App.tsx.
- [x] Refactor de estatus a los dos ejes de §3.
- [x] Capa `services/api.ts` centralizada (token por llamada + CSRF cookie).
- [x] Escaneo conectado: `GET /codigos/:codigo` → 200 ficha / 404 alta con
      código precargado. Escaneo también en iOS/escritorio vía ponyfill
      zxing-wasm.
- [x] Ficha: dos insignias de estatus, historial, cambio de ubicación con los
      3 flujos (almacén directo / punto de venta / reparación interna-mismo,
      interna-otro almacén, externa-taller), cambio de condición, cambio de
      almacén (solo ADMIN, visible y validado en backend).
- [x] Buscador/creador de lugares con deduplicación y GPS silencioso.
- [x] Alta en campo: serial o "sin serial", marca/tipo obligatorios de
      catálogo, cerveza/año/activo opcionales.
- [x] QR: `qrcode`, contenido = serial, 512 px, corrección M, descarga PNG.
- [x] Reportes (ADMIN): totales + filtros + búsqueda + paginación.
      Mi almacén (ENCARGADO/ADMIN): misma lista fijada a su almacén.
- Pendiente menor: advertencia al cerrar sesión con cola local sin
  sincronizar (la cola quedó como legado de solo lectura en /debug).

## 6. Pruebas y deploy

- [ ] Probar el escaneo en el teléfono contra datos reales del Data Store
      (etiquetas reales — validar qué trae el código de fábrica: ¿serie?,
      ¿modelo?, ¿UPC?).
- [ ] Probar la idempotencia: repetir un `POST` de movimiento con el mismo
      `uuid_cliente` y verificar que no duplica.
- [ ] Probar permisos: TECNICO intentando `PATCH /equipos/:id/almacen` debe
      recibir 403.
- [ ] Paginación con volumen realista, no con 20 registros.
- [ ] `catalyst deploy` y prueba completa en la URL de desarrollo desde el
      S26 Ultra.

## Fuera de alcance de esta versión (no construir)

Traslados con doble aprobación (tablas listas, sin UI) · fotos · comodato ·
modo offline completo · catálogos editables desde la interfaz · APK nativo
(Capacitor queda para después de validar con el cliente).
