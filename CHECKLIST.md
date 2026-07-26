# Fridge Tracker — checklist de construcción

Todo lo que falta hacer manualmente, en el orden sugerido por la spec
(`fridgetracker.md` §11). Marca cada casilla al completarla. Referencias:
contexto en `CLAUDE.md`, esquema completo en `fridgetracker.md`.

---

## 0. Git y deploy inicial

- [ ] Crear el repositorio remoto en GitHub (o pedir acceso al del colega) y
      conectarlo: `git remote add origin <url>` → `git push -u origin master`.
      El repo local ya está en la raíz del proyecto con la fusión commiteada.
- [ ] `catalyst deploy` de prueba para verificar que el cliente sube y carga en
      `https://demo-890811559.development.catalystserverless.com`.

## 1. Data Store — las 9 tablas (spec §5)

Crear por CLI/SDK/MCP desde el esquema, **no a mano en la consola**. En la
consola solo se hace clic en "Start Exploring" de Data Store la primera vez.

- [ ] "Start Exploring" en Data Store (consola, una sola vez).
- [ ] `Almacen` — 14 columnas; `cp` como **Text**, nunca Int.
- [ ] `Lugar` — puntos de venta y talleres unificados; `nombre_normalizado`
      (minúsculas sin acentos). El único compuesto (tipo + nombre_normalizado)
      no existe en Data Store → se valida en el backend.
- [ ] `Usuario` — `catalyst_user_id` con índice único; rol
      `TECNICO`/`ENCARGADO`/`ADMIN`.
- [ ] `AlmacenEncargado` — N a N; sin interfaz en esta versión, la tabla se
      crea ya.
- [ ] `Refrigerador` — `serial` **sin** índice único (hay duplicados y "N/D"
      en los datos reales); dos ejes de estatus.
- [ ] `CodigoEquipo` — `codigo` con **índice único global**; aquí vive la
      unicidad del sistema.
- [ ] `Movimiento` — append-only; `uuid_cliente` con índice único
      (idempotencia).
- [ ] `SolicitudTraslado` — tabla lista, sin interfaz.
- [ ] `Catalogo` — una tabla para marca/modelo/tipo/cerveza.
- [ ] Revisar permisos App User de cada tabla (o decidir que solo la función
      con scope admin toca el Data Store — recomendado).

## 2. Datos semilla e importación (spec §10)

- [ ] Almacenes: Torreón, Gómez Palacio, Lerdo (lat/lng aproximados).
- [ ] Catálogo: marcas (Criotec, Froster, Hussmann, Imbera, Metalfrio, NSF),
      tipos (Refrigerador, Máq. hielo, Cám. fría), cervezas (Corona, Modelo,
      Budlight, Michelob, Modelorama).
- [ ] Lugares PUNTO_VENTA (6) y TALLER (2) de la spec.
- [ ] Script de importación: ~40 renglones de `Inventario_Auditoria.xlsx`
      (hoja TRC) con el mapeo de columnas de la spec §10. **Conseguir el
      archivo Excel** — no está en el repo.
- [ ] Limpieza en la importación: deduplicar seriales, saltar "N/D" o
      longitud < 8, normalizar marcas contra el catálogo ("IMBERA" vs
      "Imbera"). Esta lógica se reutilizará con los ~9,000 equipos reales.
- [ ] Verificar los datos en la consola.

## 3. Authentication

- [ ] "Start Exploring" en Authentication (consola).
- [ ] Dar de alta el dominio del cliente en **CORS / Authorized Domains**
      (el dominio `.development.catalystserverless.com`; si se migra a Slate,
      también `*.onslate.com`).
- [ ] Crear usuarios: un TECNICO (Torreón) y un ADMIN.
- [ ] Insertar sus renglones en la tabla `Usuario` (rol + almacén base),
      ligados por `catalyst_user_id`.
- [ ] **No** habilitar API Gateway (spec §1.2).

## 4. Backend — Advanced I/O Function (spec §6)

- [ ] `catalyst functions:add` → tipo **Advanced I/O**, Node.js (stack
      reciente), Express. La carpeta `functions/` está vacía hoy.
- [ ] Middleware de auth: validar el token del header `Authorization`,
      resolver el `Usuario` y su rol.
- [ ] `GET /codigos/:codigo` — resuelve código escaneado (200 equipo / 404).
- [ ] `POST /equipos` — alta en campo; crea el código principal; estatus
      inicial EN_ALMACEN + OPERATIVO; `almacen_id` = el del usuario.
- [ ] `GET /equipos` — filtros por almacén/estatus/búsqueda, **con paginación**
      (ZCQL limita filas por respuesta).
- [ ] `GET /equipos/:id` — ficha + historial de movimientos.
- [ ] `POST /equipos/:id/movimientos` — valida los dos ejes (spec §3),
      idempotente por `uuid_cliente` (si existe → 200 con el existente),
      escribe `Movimiento` y actualiza el denormalizado en `Refrigerador`.
- [ ] `PATCH /equipos/:id/almacen` — **solo ADMIN**, validado en backend.
- [ ] `GET /lugares?tipo=&q=` — búsqueda contra `nombre_normalizado`.
- [ ] `POST /lugares` — si la normalización colisiona, devuelve el existente.
- [ ] `GET /almacenes` y `GET /catalogos?tipo=`.
- [ ] Probar todos los endpoints con curl/Postman antes de tocar el cliente.

## 5. Frontend — de mockup a app (react-app/)

- [ ] Refactor `src/types/estatus.ts`: del catálogo de 10 estatus del mockup a
      los **dos ejes** de la spec §3 (unión de literales, no string).
- [ ] Capa `src/services/api.ts`: obtiene token con
      `catalyst.auth.generateAuthToken()` **justo antes de cada llamada**
      (dura 1 h, no se guarda) y centraliza todas las llamadas al backend.
      Incluir el SDK web de Catalyst en `public/index.html`.
- [ ] Login (técnico/admin) con Catalyst Auth; quitar el `usuarioId: 0` fijo
      de `evento.ts` / `EscaneoPage.tsx`.
- [ ] Conectar el escaneo a `GET /codigos/:codigo`: 200 → ficha; 404 → alta
      con el código precargado (flujo de la spec §7).
- [ ] Ficha del equipo: datos + historial + acciones de cambio de
      ubicación/condición (`POST /equipos/:id/movimientos`).
- [ ] Flujo cambio de ubicación: EN_ALMACEN directo; EN_UBICACION busca/crea
      Lugar PUNTO_VENTA; EN_REPARACION interna (mismo/otro almacén) o externa
      + Lugar TALLER.
- [ ] Buscador/creador de lugares con deduplicación (la lista se muestra
      **antes** de habilitar "Crear nueva ubicación"); GPS capturado en
      silencio al crear.
- [ ] Alta en campo: serial (o "sin serial"), marca y tipo obligatorios;
      autocompletado contra `GET /catalogos`.
- [ ] Generación de QR: librería `qrcode` (npm), contenido = `serial` (no el
      ROWID), canvas 512×512, corrección M, botón "Descargar PNG".
- [ ] Tabla de administración (escritorio): ENCARGADO ve su almacén, ADMIN ve
      todo; cambio de almacén solo ADMIN.
- [ ] Contador de pendientes: mantener; advertencia al cerrar sesión con cola
      sin sincronizar.

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
