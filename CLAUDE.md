# Fridge Tracker

Sistema de trazabilidad de refrigeradores para una empresa que renta equipo de frío con publicidad de distintas marcas a puntos de venta (tiendas, changarros, negocios) en la Comarca Lagunera.

**Estado actual: construyendo el mockup funcional v1.** No hay backend todavía. La prioridad es una demo que escanee de verdad en un teléfono real.

---

## Los dos bloques del sistema

**Bloque 1 · Inventario.** Los almacenes son bodegas, no puntos de venta. Llega un refrigerador, se escanea el código de barras que ya trae de fábrica, de ahí sale el **número de serie** (llave única del sistema), y con esa llave se abre la ficha existente o se da de alta una nueva. Después: ficha técnica, ubicación interna, diagnóstico con checklist y hasta 5 fotos, y clasificación por estatus.

**Bloque 2 · Movilidad.** El equipo sale del almacén al punto de venta bajo un comodato. El comodato es un *gate*: sin papelería completa o con el equipo retenido, no hay salida. Escaneo de salida → tránsito → escaneos en puntos de control con GPS → escaneo de entrega.

**El estatus es la columna vertebral.** Un único estatus vigente por equipo. Cada cambio escribe historial con usuario, fecha/hora y motivo. El escaneo no es adorno de UI: es el evento que dispara las transiciones.

### Catálogo de estatus

`Recibido` · `En diagnóstico` · `Disponible / OK` · `Con observaciones` · `No funcional / dañado` · `En cuarentena / retenido` · `Apto para salir` · `En tránsito` · `Entregado / Colocado` · `Baja`

---

## Stack

### Fase mockup (ahora)

| Pieza | Decisión |
|---|---|
| Framework | React + TypeScript + Vite |
| Estilos | Tailwind |
| Ruteo | react-router |
| Persistencia local | Dexie (IndexedDB) |
| Escaneo | `BarcodeDetector` nativo del navegador |
| Plugins de Capacitor | **Ninguno.** Cero. |

### Fase nativa (después de validar con el cliente)

| Pieza | Decisión |
|---|---|
| Contenedor | Capacitor |
| Escaneo | `@capacitor-mlkit/barcode-scanning` |
| Persistencia local | `@capacitor-community/sqlite` |
| Cámara / GPS / Red / Prefs / FS | `@capacitor/*` oficiales |
| OTA | `@capawesome/capacitor-live-update` |
| Backend | Zoho Catalyst — Advanced I/O Functions (Node.js) |
| Base de datos | Catalyst Data Store (ZCQL) |
| Archivos | Catalyst Stratus |
| Panel web | React en Catalyst Web Client Hosting |
| Auth | JWT propio, **no** el SDK de Catalyst |

---

## Reglas de arquitectura no negociables

Estas salieron de decisiones deliberadas. No las cambies sin discutirlo.

### 1. Capa de servicios abstraída

Todo acceso a capacidades del dispositivo pasa por una interfaz. La app nunca llama directo a una API del navegador ni a un plugin de Capacitor.

```
src/services/
  scanner.ts      // escanear(): Promise<string>
  storage.ts      // encolar(evento), pendientes(), marcarSincronizado()
  camera.ts       // tomarFoto(): Promise<Blob>
  location.ts     // posicionActual(): Promise<Coords>
```

Cada uno con `.web.ts` y (después) `.native.ts`, seleccionados por `Capacitor.isNativePlatform()`. **Este es el mecanismo que hace que el mockup no sea desechable.** Si escribes una llamada directa a `navigator.geolocation` fuera de `location.web.ts`, está mal.

### 2. Encolar eventos, no estados

**Nunca** guardes "el equipo X ahora está En tránsito". Guarda el evento:

```ts
{
  uuid: string,              // generado en el cliente, crypto.randomUUID()
  tipo: 'ESCANEO_SALIDA',
  numeroSerie: string,
  usuarioId: number,
  fechaEvento: string,       // ISO, reloj del dispositivo
  gps?: { lat: number, lng: number, precisionM: number },
  capturaManual: boolean,
}
```

El estatus vigente se **deriva** reproduciendo los eventos en orden. Si guardas estados, el último en sincronizar gana y se pierde el historial — que es el producto que se está vendiendo.

### 3. El UUID del cliente es la llave de idempotencia

Generado en el dispositivo al crear el evento, nunca en el servidor. Sin esto, cualquier reintento de red duplica registros, y los reintentos van a ser constantes en ruta.

### 4. Dos marcas de tiempo, y `fechaEvento` manda

- `fechaEvento` — reloj del dispositivo. **Ordena la lógica de negocio.**
- `fechaSincronizacion` — reloj del servidor. Solo auditoría.

Resolver conflictos por timestamp del servidor está **mal**: ese timestamp es cuándo sincronizó, no cuándo ocurrió. Un escaneo de las 9:00 AM que sube a las 6:00 PM quedaría después de uno de las 4:00 PM.

### 5. Captura manual siempre disponible

Toda pantalla de escaneo lleva un botón para teclear el número de serie a mano. Nunca dejes al operador bloqueado por una etiqueta ilegible. Los eventos capturados manualmente se marcan con `capturaManual: true`.

### 6. Fotos: comprimir antes de encolar, cola separada

Canvas a ~1200px de lado largo, JPEG calidad 0.7 → ~150-250 KB. Cola aparte y de **menor prioridad** que los eventos: el estatus se actualiza aunque las fotos tarden.

### 7. Lectura offline

Para abrir una ficha escaneando sin señal, la app necesita copia local del inventario del almacén asignado al usuario. Sincronización descendente al iniciar sesión y al detectar WiFi.

### 8. Contador de pendientes siempre visible

Y advertencia al cerrar sesión si hay cola sin sincronizar. Es la única defensa contra "el operador desinstaló la app con 40 escaneos encolados".

---

## Gotchas conocidos

**`BarcodeDetector` no existe en Safari/iOS.** Todos los navegadores de iOS usan WebKit y ninguno lo implementa. En `scanner.web.ts` hay que detectar disponibilidad y degradar (a captura manual en el mockup; a ZBar-WASM si hace falta soporte iOS en web).

**Los códigos 1D son mucho más difíciles de leer que los QR.** Sin patrones de localización ni corrección de errores. Etiquetas viejas, grasosas o descoloridas van a fallar. Por eso la regla 5.

**No está verificado que el código de fábrica contenga el número de serie.** Puede ser modelo, lote o UPC. Pendiente de validar con etiquetas reales.

**ML Kit descarga su módulo vía Google Play Services la primera vez.** Hay que verificar con `isGoogleBarcodeScannerModuleAvailable()` antes de usar, o empaquetar el modelo en el APK. Escenario de falla: teléfono nuevo, primer día en bodega sin señal.

**Data Store limita filas por respuesta (ZCQL).** Paginación obligatoria en todo endpoint de listado, desde el diseño. Probar con volumen realista, no con 20 registros.

**Data Store no tiene PostGIS.** Guardar lat/lng como decimales; distancias con haversine en la función.

**El SDK de Catalyst no encaja con el origen de Capacitor.** El origen es `capacitor://localhost`, lo que vuelve cross-origin las cookies de sesión. De ahí el JWT propio. Hay que poner en whitelist `capacitor://localhost` y `https://localhost` en CORS, también para Stratus.

**`@capacitor/camera` 8.1.0 cambió la API.** `getPhoto` y `pickImages` están deprecados y el prompt nativo cámara/galería ya no viene incluido. Ignora tutoriales viejos.

**Catalyst se factura aparte de Zoho One/CRM.** Estimar invocaciones y GB antes de comprometer precio.

---

## Convenciones de código

- **Dominio en español, técnica en inglés.** `numeroSerie`, `comodato`, `puntoVenta`, `estatusVigente` — son términos de negocio sin traducción limpia (especialmente "comodato"). Los nombres técnicos (`fetchInventory`, `useDebounce`, `SyncQueue`) en inglés. No mezclar dentro de un mismo identificador.
- **TypeScript estricto.** Tipos explícitos para eventos, estatus y transiciones. El catálogo de estatus es una unión de literales, no `string`.
- Mobile-first. La app la usa un operador de bodega con una mano, con guantes, con mala luz. Targets táctiles grandes, contraste alto, nada de hovers.
- Sin librerías de UI pesadas en el mockup. Tailwind y componentes propios.

---

## Lo que NO hay que hacer

- No instalar plugins de Capacitor durante la fase de mockup.
- No llamar APIs del navegador fuera de la capa de servicios.
- No guardar estados en la cola offline; solo eventos.
- No generar el UUID de eventos en el servidor.
- No asumir que hay conexión en ningún punto del flujo de operación.
- No construir el flujo de renta/facturación todavía — está sin definir (ver preguntas abiertas).

---

## Preguntas abiertas con el cliente

Afectan alcance. No inventes respuestas ni construyas suposiciones sobre estos puntos.

1. **¿Renta con publicidad o comodato?** El documento maestro modela comodato de distribuidora, pero el negocio real parece ser renta con publicidad rotativa. Si hay renta, falta toda la capa comercial: tarifa, vigencia, facturación, renovación.
2. **¿El patrocinador cambia durante la vida del equipo?** Si la publicidad rota, el patrocinador es un atributo con historia, no un campo fijo, y falta el flujo de recambio de vinil.
3. **¿Cómo regresan los equipos?** No existe flujo de retiro, recolección ni mantenimiento en campo. El estatus `Baja` existe sin proceso que lleve a él.
4. **¿Qué teléfonos usan operadores y choferes?** Define si iOS entra al alcance.
5. **Volumen:** cuántos equipos, almacenes, puntos de venta y usuarios.
6. **¿Quién es dueño de los teléfonos?** Afecta política de sincronización y manejo de sesiones.

---

## Roles del sistema

| Rol | Permisos |
|---|---|
| Administrador | Usuarios, catálogos, almacenes, reportes globales |
| Operador de almacén | Diagnóstico, cambio de estatus, ubicación, escaneo |
| Responsable de logística | Validación de comodato, alta de movimientos, destino |
| Chofer / repartidor | Escaneo en puntos de control, confirmación de entrega |
| Cliente / propietario | Solo lectura de sus equipos (opcional, fase 3) |
