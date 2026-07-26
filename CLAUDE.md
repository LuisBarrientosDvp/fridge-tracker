# Fridge Tracker — contexto completo del proyecto

Sistema de trazabilidad de refrigeradores para una empresa que renta equipo de
frío con publicidad de distintas marcas a puntos de venta (tiendas, changarros,
negocios) en la Comarca Lagunera.

**Fase actual: fullstack sobre Zoho Catalyst.** Este documento fusiona el
`CLAUDE.md` del mockup (`fridge-tracker-master`, ya eliminado tras la fusión)
con las decisiones de la especificación v3 y el setup de Catalyst.

## Jerarquía de documentos

| Documento | Rol |
|---|---|
| `fridgetracker.md` | **Especificación autoritativa (v3).** Modelo de datos (9 tablas), endpoints, roles, flujo de escaneo, datos semilla. Ante conflicto, manda este documento |
| `CLAUDE.md` (este) | Contexto de trabajo: arquitectura, reglas, gotchas, decisiones de la fusión |
| `CHECKLIST.md` | Lista de todo lo que falta construir manualmente, en orden |
| `react-app/README.md` | Cómo correr, probar desde el teléfono y deployar el cliente |

---

## Estructura del proyecto (raíz Catalyst)

```
PACNOR DEMO/
├── catalyst.json        # Config del CLI — cliente = react-app con plugin React. NO editar a mano
├── .catalystrc          # Identidad del proyecto (id 33866000000045392, "DEMO",
│                        #   dominio demo-890811559.development). NO editar / NO commitear
├── functions/           # Vacío — aquí va la Advanced I/O Function (ver CHECKLIST)
├── react-app/           # Cliente web: mockup portado a CRA/Catalyst (fuente de verdad)
├── fridgetracker.md     # Especificación v3
├── CLAUDE.md            # Este archivo
└── CHECKLIST.md         # Pendientes manuales
```

- Proyecto Catalyst: **DEMO** (`33866000000045392`), DC US, entorno Development
  `890811559`, timezone America/Mexico_City.
- URL de desarrollo: `https://demo-890811559.development.catalystserverless.com`
- Hosting del frontend: **Web Client Hosting** (legacy) con
  `zcatalyst-cli-plugin-react`. La spec contempla migrar a Slate después; el
  mecanismo de auth es el mismo si frontend y backend viven en el mismo proyecto.

## Plataforma (spec v3 §1)

| Aspecto | Decisión |
|---|---|
| Backend | Zoho Catalyst — Data Store, **una** Advanced I/O Function (Node.js/Express), Authentication |
| Frontend | React + TypeScript como PWA. Portado del mockup Vite al build CRA de Catalyst |
| Hosting | Web Client Hosting ahora; Slate como destino posible |
| Dispositivo objetivo | Samsung S26 Ultra, Chrome para Android |
| Archivos | Ninguno en esta versión (sin Stratus). El QR se genera en el cliente |
| Auth | `catalyst.auth.generateAuthToken()` → header `Authorization`. Token dura 1 h: obtener justo antes de llamar, nunca guardarlo. **No usar API Gateway** (API key expuesta en PWA, mata las Security Rules) |

### Decisiones del mockup SUPERADAS por la spec v3

El mockup se construyó antes de la spec v3. Estas piezas del código heredado
**cambian** — no las tomes como referencia de producto:

1. **Estatus:** `src/types/estatus.ts` trae el catálogo viejo de 10 estatus en
   un solo eje. La v3 usa **dos ejes independientes**: `estatus_ubicacion`
   (`EN_ALMACEN` | `EN_UBICACION` | `EN_REPARACION`) y `estatus_condicion`
   (`OPERATIVO` | `MANTENIMIENTO` | `REFURBISH` | `CHATARRA`). Refactor pendiente.
2. **Auth:** el "JWT propio, no el SDK de Catalyst" del mockup era por el
   origen `capacitor://localhost` de la fase nativa. La PWA en hosting del
   mismo proyecto **sí usa el SDK de Catalyst** (`generateAuthToken`).
3. **Offline:** esta versión es **en línea**. La cola Dexie del mockup queda
   como preparación (el `uuid_cliente` ya es la llave de idempotencia que el
   backend respetará); el modo offline completo es futuro.
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
   (`Movimiento` es append-only en el Data Store). Si guardas estados, el
   último en sincronizar gana y se pierde el historial — que es el producto.
3. **El UUID del cliente es la llave de idempotencia.** `crypto.randomUUID()`
   en el dispositivo, nunca en el servidor. El backend responde 200 con el
   movimiento existente si el `uuid_cliente` ya está registrado.
4. **Dos marcas de tiempo, y `fecha_evento` manda.** `fecha_evento` = reloj del
   dispositivo, ordena la lógica de negocio. `fecha_registro` = reloj del
   servidor, solo auditoría. Resolver conflictos por timestamp del servidor
   está mal.
5. **Captura manual siempre disponible.** Toda pantalla de escaneo lleva botón
   para teclear el código a mano (`capturaManual: true`). Los códigos 1D
   fallan con etiquetas viejas o grasosas.
6. **Contador de pendientes siempre visible** y advertencia al cerrar sesión
   con cola sin sincronizar.
7. **Permisos validados en el backend**, no solo ocultando botones en la UI.
   Cambio de almacén: solo rol ADMIN. Ambos ejes de estatus se validan en el
   servidor.

## Modelo de datos — resumen (detalle completo en fridgetracker.md §5)

9 tablas: `Almacen`, `Lugar`, `Usuario`, `AlmacenEncargado`, `Refrigerador`,
`CodigoEquipo`, `Movimiento`, `SolicitudTraslado`, `Catalogo`.

Puntos que muerden:
- **CP siempre Text, nunca Int** (los que empiezan con cero pierden el dígito).
- Direcciones opcionales salvo el nombre.
- Índices únicos: `CodigoEquipo.codigo` (global), `Movimiento.uuid_cliente`,
  `Usuario.catalyst_user_id`. Los únicos **compuestos** (`Lugar` tipo +
  nombre_normalizado; `AlmacenEncargado` almacen + usuario) no existen en
  Data Store → se garantizan en el backend.
- Deduplicación de `Lugar`: buscar contra `nombre_normalizado` (minúsculas sin
  acentos); si colisiona, el backend devuelve el existente en vez de duplicar.
- `SolicitudTraslado` y `AlmacenEncargado` se crean ya, sin interfaz.

## Endpoints (detalle en fridgetracker.md §6)

Una sola Advanced I/O Function con Express: `GET /codigos/:codigo`,
`POST/GET /equipos`, `GET /equipos/:id`, `POST /equipos/:id/movimientos`,
`PATCH /equipos/:id/almacen` (solo ADMIN), `GET/POST /lugares`,
`GET /almacenes`, `GET /catalogos`.

## Gotchas conocidos

**Frontend / dispositivo:**
- `BarcodeDetector` no existe en Safari/iOS (todos los navegadores de iOS son
  WebKit). `scanner.web.ts` detecta y degrada a captura manual — verificado en
  iPhone 17 el 2026-07-25. Fallback posible: `@zxing/browser` o ZBar-WASM.
- WebKit niega la geolocalización con certificado autofirmado: en dev los
  eventos de iPhone van sin GPS. Con certificado válido (producción) no aplica.
- HTTPS obligatorio en dev: `getUserMedia` exige contexto seguro
  (`HTTPS=true` en `react-app/.env`).
- No está verificado que el código de fábrica contenga el número de serie
  (puede ser modelo, lote o UPC). Pendiente de validar con etiquetas reales —
  por eso la pantalla de escaneo muestra la cadena cruda y el formato.
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

**Build (post-fusión):**
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
- No usar API Gateway para la PWA (ver §1.2 de la spec).
- No guardar el token de auth (dura 1 h; se pide justo antes de llamar).
- No crear las tablas a mano en la consola: por CLI/SDK/MCP desde el esquema
  de la spec (§5), para que sea reproducible.
- No construir traslados con doble aprobación, fotos, comodato ni modo
  offline en esta versión.
- Nunca pasar credenciales, API keys ni tokens por chat: el CLI de Catalyst ya
  está autenticado en la máquina del desarrollador.

## Orden de construcción sugerido (spec §11)

1. Esquema de las 9 tablas + datos semilla + importación de la muestra del
   Excel. Verificar en consola.
2. Advanced I/O Function con los endpoints. Probar con curl/Postman.
3. Resolución de escaneo (`GET /codigos/:codigo`) contra datos reales.
4. Cliente: login + capa `api.ts` centralizada con el token.
5. Pantalla de escaneo + ficha + cambio de estatus.
6. Alta en campo.
7. Generación de QR (librería `qrcode`, contenido = `serial`, 512×512, nivel M).
8. Tabla de administración.

Cada paso verificable antes del siguiente. El error típico es pedir la app
completa de un tiro y terminar depurando tres capas sin saber cuál falla.

## Preguntas abiertas con el cliente

No inventes respuestas ni construyas suposiciones sobre estos puntos:

1. ¿Renta con publicidad o comodato? Si hay renta, falta toda la capa comercial.
2. ¿El patrocinador cambia durante la vida del equipo? (vinil rotativo)
3. ¿Cómo regresan los equipos? No existe flujo de retiro/recolección.
4. ¿Qué teléfonos usan operadores y choferes? Define si iOS entra al alcance.
5. Volumen: cuántos equipos, almacenes, puntos de venta y usuarios.
6. ¿Quién es dueño de los teléfonos? Afecta sincronización y sesiones.
7. ¿Un encargado puede cubrir varios almacenes? (el modelo ya lo permite vía
   `AlmacenEncargado`)
8. ¿`Modelo` como catálogo dependiente de marca o texto con autocompletado?
   Propuesta: autocompletado contra `Catalogo`.
