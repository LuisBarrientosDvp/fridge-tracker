# Fridge Tracker — Especificación Completa del Demo

**Versión 3 · Documento consolidado**

Contexto de desarrollo para Claude Code. Reúne todas las decisiones tomadas hasta ahora sobre plataforma, arquitectura, modelo de datos, endpoints y alcance.

---

## 1. Plataforma y arquitectura

| Aspecto | Decisión |
|---|---|
| Backend | Zoho Catalyst — Data Store, Advanced I/O Function (Node.js), Authentication |
| Frontend | React + TypeScript, empaquetado como PWA |
| Hosting | Slate (frontend de Catalyst). El demo puede arrancar en Web Client Hosting y migrar |
| Dispositivo objetivo | Samsung S26 Ultra, Chrome para Android |
| Almacenamiento de archivos | Ninguno en esta versión (sin Stratus). El QR se genera en el cliente |

### 1.1 Por qué PWA y no APK nativo

Un solo código sirve al técnico en Android y al administrador en escritorio. El equipo domina React, no Android nativo. La PWA se actualiza sola al abrirla, sin reinstalar en cada teléfono. Las capacidades necesarias (cámara, GPS, NFC, almacenamiento) existen en Chrome Android. Si más adelante hace falta un APK instalable, la ruta es envolver la misma PWA con Capacitor (5-8 días), no reescribir en nativo (30-50 días). La decisión de PWA no cierra la puerta a un APK después; empezar en nativo sí cerraría la puerta a la web.

### 1.2 Autenticación con Slate

Frontend y backend deben vivir en el **mismo proyecto de Catalyst** — es el requisito del que depende todo el mecanismo. El cliente obtiene el token con `catalyst.auth.generateAuthToken()`, lo lee de `access_token` y lo envía en el header `Authorization` de cada llamada al backend. El token es válido **una hora**, por lo que se obtiene justo antes de llamar y nunca se guarda. El dominio de Slate (`*.onslate.com` en el DC de US) debe darse de alta en el CORS del componente Authentication.

**No usar API Gateway** para esto. Su autenticación es de máquina a máquina con API key, que en una PWA queda expuesta al público y no identifica qué usuario hizo cada cambio. Además, al habilitarlo se deshabilitan las Security Rules y las funciones quedan inaccesibles hasta crear APIs para cada una. API Gateway tiene sentido solo si un tercero externo (un ERP) necesita consultar el inventario más adelante.

### 1.3 Preparación para offline (futuro)

Esta versión es en línea, pero el esquema ya la prepara. Cada movimiento lleva un `uuid_cliente` generado en el dispositivo, que sirve de clave de idempotencia: si una sincronización se reintenta, el backend reconoce el UUID y no duplica. Cuando se agregue el modo offline, la cola guardará eventos sin credenciales y el token se adjuntará solo al sincronizar. Las fotos quedan explícitamente fuera de la cola offline por su peso; solo el cambio de estatus (un JSON pequeño) se encola.

---

## 2. Alcance de esta versión

**Incluido:** login (técnico/admin); escaneo de código de barras o QR con la cámara; resolución del código a un equipo; alta en campo de un equipo no registrado; cambio de estatus de ubicación y de condición; creación y reutilización de ubicaciones; generación y descarga de QR en PNG; historial completo de movimientos; tabla de administración en escritorio; cambio de almacén solo por admin y directo.

**Explícitamente fuera:** solicitudes de traslado con doble aprobación (las tablas quedan listas, la interfaz no se construye); fotos; comodato; operación sin conexión; catálogos editables desde la interfaz.

---

## 3. Los dos ejes de estatus

El inventario real demuestra que "dónde está" y "en qué condición está" son independientes. Un refrigerador puede estar colocado en una tienda **y** estar marcado como chatarra. Se modelan en dos campos separados. Mezclarlos en uno solo perdería la mitad de la información desde el primer registro.

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

Valores derivados del inventario real (CHATARRA, PARA REFURBISH, MANTENIMIENTO) más OPERATIVO por defecto. **Ambos ejes se validan en el backend.**

---

## 4. Identificadores: un equipo tiene varios códigos

El inventario real trae dos identificadores por equipo: `Series` (serial de placa, largo) y `Activo` (número de activo, más corto). El serial no siempre es legible ni único — los datos reales contienen duplicados y valores "N/D". Por eso:

- `Refrigerador.serial` **no lleva índice único**; es un atributo informativo.
- La unicidad vive en `CodigoEquipo.codigo`, con índice único global.
- Un equipo puede tener N códigos (serial de placa, número de activo, QR generado); cualquiera lo resuelve a la misma ficha.
- Un equipo sin código legible se puede registrar igual y se le asocia un código después, al etiquetarlo.
- Físicamente un refri trae varios códigos de barras encima (placa, eficiencia energética, número de parte, logística). La tabla `CodigoEquipo` evita que escanear el equivocado rompa la correspondencia.

---

## 5. Modelo de datos — 9 tablas

Tipos expresados en términos de Data Store de Catalyst. **Crear por CLI/SDK desde este esquema, no a mano.** El CP siempre va como **Text, nunca Int** (los que empiezan con cero pierden el dígito). Todas las direcciones son **opcionales** salvo el nombre; el técnico en campo no siempre tiene la dirección completa.

### 5.1 `Almacen`

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

### 5.2 `Lugar`

Puntos de venta y talleres externos, unificados. Misma estructura de dirección que el almacén.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo` | Text (20) | Sí | `PUNTO_VENTA` \| `TALLER` |
| `nombre` | Text (200) | Sí | Como lo escribe el técnico |
| `nombre_normalizado` | Text (200) | Sí | Minúsculas sin acentos. **Índice único con `tipo`** |
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

**Deduplicación:** al escribir el nombre, el cliente busca contra `nombre_normalizado` con coincidencia parcial y muestra resultados. "Crear nueva ubicación" se habilita solo después de ver la lista. Si la normalización colisiona con una existente, el backend devuelve la existente en vez de duplicar.

### 5.3 `Usuario`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `catalyst_user_id` | Text (60) | Sí | ID de Catalyst Auth. **Índice único** |
| `nombre` | Text (120) | Sí | |
| `correo` | Text (150) | No | |
| `telefono` | Text (30) | No | |
| `rol` | Text (20) | Sí | `TECNICO` \| `ENCARGADO` \| `ADMIN` |
| `almacen_id` | BigInt | No | Almacén base |
| `activo` | Boolean | Sí | default true |

### 5.4 `AlmacenEncargado`

Asignación N a N entre almacenes y encargados. Define quién puede aprobar traslados en cada almacén. Se crea ahora porque la función de traslado (futura) pregunta exactamente esto.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `almacen_id` | BigInt | Sí | **Índice único con `usuario_id`** |
| `usuario_id` | BigInt | Sí | |
| `puede_aprobar_traslados` | Boolean | Sí | default true |
| `fecha_asignacion` | DateTime | Sí | |

### 5.5 `Refrigerador`

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

### 5.6 `CodigoEquipo`

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `refrigerador_id` | BigInt | Sí | FK |
| `codigo` | Text (200) | Sí | **Índice único global** |
| `formato` | Text (20) | Sí | `code_128`, `qr_code`, `activo`, etc. |
| `es_principal` | Boolean | Sí | El que se considera el serial |
| `fecha_alta` | DateTime | Sí | |

Al dar de alta un equipo se crea el código principal automáticamente si hay serial. El número de activo entra como segundo código con `formato = activo`.

### 5.7 `Movimiento`

Historial completo. **Append-only:** nunca se edita ni se borra. Todo cambio de estatus, ubicación, condición o almacén escribe un renglón aquí. El estatus actual del refri es un valor denormalizado que se recalcula a partir del último movimiento.

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

### 5.8 `SolicitudTraslado`

Tabla lista, **sin interfaz en esta versión**. Se define ahora para no migrar después.

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

### 5.9 `Catalogo`

Para que marca, modelo, tipo y cerveza no sean texto libre. Una sola tabla para los cuatro.

| Columna | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo_catalogo` | Text (20) | Sí | `MARCA`\|`MODELO`\|`EQUIPO_TIPO`\|`CERVEZA` |
| `valor` | Text (80) | Sí | |
| `activo` | Boolean | Sí | |

---

## 6. Endpoints

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

**Idempotencia:** si el `uuid_cliente` de un movimiento ya existe, devolver 200 con el existente en vez de crear otro. Esto hará funcionar la cola offline futura sin cambiar el backend.

**Permisos validados en el backend, no solo ocultando botones en la interfaz.**

---

## 7. Flujo de escaneo

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

`BarcodeDetector` está disponible en Chrome para Android (objetivo: S26 Ultra). Para escritorio o navegadores sin soporte, usar `@zxing/browser` como respaldo detrás de una detección de capacidad.

---

## 8. Generación del QR

Cliente puro, sin backend ni almacenamiento. Librería `qrcode` (npm). **Contenido del QR: el valor de `serial`**, no el ROWID. Se pinta en `<canvas>`, botón "Descargar PNG" con `canvas.toDataURL('image/png')`. Tamaño 512×512 px con margen, corrección de errores nivel M.

Razón de codificar el serial: el QR y el código de barras de fábrica entran por el mismo resolvedor (`GET /codigos/:codigo`), un solo camino de código, y las etiquetas impresas siguen sirviendo si la base se reimporta y los ROWID cambian.

---

## 9. Roles y permisos

| Acción | TECNICO | ENCARGADO | ADMIN |
|---|---|---|---|
| Escanear y ver ficha | Sí | Sí | Sí |
| Cambiar estatus (ubicación/condición) | Sí | Sí | Sí |
| Dar de alta equipo en campo | Sí | Sí | Sí |
| Crear ubicación | Sí | Sí | Sí |
| Cambiar almacén del equipo | No | No | Sí |
| Ver tabla de administración | No | Solo su almacén | Todos |

---

## 10. Datos semilla

**Almacenes:** Torreón, Gómez Palacio, Lerdo (con lat/lng aproximados de cada ciudad y direcciones de ejemplo).

**Catálogo — marcas:** Criotec, Froster, Hussmann, Imbera, Metalfrio, NSF.
**Catálogo — tipos:** Refrigerador, Máq. hielo, Cám. fría.
**Catálogo — cervezas:** Corona, Modelo, Budlight, Michelob, Modelorama.

**Lugares `PUNTO_VENTA`:** Abarrotes La Esquina (Torreón), Licorería El Roble (Torreón), Súper Ahorro Centro (Gómez Palacio), Tienda Doña Chuy (Gómez Palacio), Minisúper Las Palmas (Lerdo), Depósito San Isidro (Lerdo).

**Lugares `TALLER`:** Refrigeración Industrial del Norte (Torreón), Servicios Térmicos Lerdo (Lerdo).

**Equipos:** importar ~40 renglones del Excel real (`Inventario_Auditoria.xlsx`, hoja TRC) como muestra, repartidos entre los tres almacenes.

**Mapeo de columnas del Excel:** `Series`→`serial`, `Activo`→`num_activo`, `Equipo`→`equipo_tipo`, `Marca`→`marca`, `Modelo`→`modelo`, `Año`→`anio`, `Estatus`→`estatus_condicion` (CHATARRA→CHATARRA, PARA REFURBISH→REFURBISH, MANTENIMIENTO→MANTENIMIENTO). `estatus_ubicacion`→`EN_ALMACEN` por defecto. `origen_registro`→`IMPORTACION`.

**Limpieza en la importación:** deduplicar seriales repetidos; saltar o importar sin código los renglones con serial "N/D" o de longitud < 8; normalizar la marca contra el catálogo (el Excel tiene "IMBERA" e "Imbera" en hojas distintas). Esta misma lógica servirá al importar los ~9,000 equipos reales.

**Usuarios:** un TECNICO en Torreón y un ADMIN. Crear en Authentication al llegar al login.

---

## 11. Orden de construcción sugerido

1. Esquema de las 9 tablas + datos semilla + importación de la muestra del Excel. Verificar en consola.
2. Advanced I/O Function con los endpoints. Probar con curl/Postman.
3. Resolución de escaneo (`GET /codigos/:codigo`) contra datos reales.
4. Cliente: login + capa `api.js` centralizada con el token de Slate.
5. Pantalla de escaneo + ficha + cambio de estatus.
6. Alta en campo.
7. Generación de QR.
8. Tabla de administración.

Cada paso verificable antes del siguiente. El error típico es pedir la app completa de un tiro y terminar depurando tres capas sin saber cuál falla.

**Nota de seguridad:** Claude Code corre en la máquina del desarrollador con la sesión del CLI ya autenticada. Nunca es necesario pasar credenciales, API keys ni tokens por chat.

---

## 12. Puntos abiertos

1. **Encargados por almacén:** el esquema soporta varios vía `AlmacenEncargado`, con un `encargado_principal_id` en `Almacen` para mostrar en pantalla. Confirmar si un encargado puede cubrir varios almacenes (el modelo ya lo permite).
2. **Reparación interna en otro almacén:** resuelto con `almacen_reparacion_id`.
3. **GPS al crear ubicación:** recomendación de capturarlo automáticamente y en silencio.
4. **Campos obligatorios en alta de campo:** propuesta — serial (o "sin serial"), marca, equipo_tipo. Modelo y el resto, opcionales.
5. **Modelo:** ¿catálogo dependiente de marca o texto con autocompletado? Propuesta: texto con autocompletado contra `Catalogo`.
6. **Traslados con doble aprobación:** fuera de esta versión; tablas `SolicitudTraslado` y `AlmacenEncargado` ya listas.
