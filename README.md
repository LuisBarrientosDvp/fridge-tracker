# Fridge Tracker — mockup funcional v1

Sistema de trazabilidad de refrigeradores en renta/comodato para puntos de venta
de la Comarca Lagunera. Esta fase es un **mockup funcional sin backend**: todo
vive en el dispositivo (IndexedDB vía Dexie). El objetivo inmediato es validar
el escaneo de códigos de barras con etiquetas reales en bodega, desde un
teléfono Android con Chrome.

**Lee `CLAUDE.md` antes de tocar el código.** Ahí están las reglas de
arquitectura no negociables, los gotchas conocidos y las preguntas abiertas
con el cliente. Este README solo cubre cómo correr y continuar el proyecto.

---

## Requisitos

- Node.js 22+
- Un teléfono Android con Chrome en la misma red Wi-Fi que tu máquina
  (iOS **no** puede escanear en esta fase: ningún navegador de iOS implementa
  `BarcodeDetector`; la app degrada a captura manual)

## Instalar y correr

```bash
npm install
npm run dev
```

Vite imprime dos URLs:

- `https://localhost:5173/` — para tu máquina
- `https://<tu-ip-local>:5173/` — para el teléfono

## Probar desde el teléfono

1. Teléfono y máquina en la **misma red Wi-Fi**.
2. Abre en Chrome del teléfono `https://<tu-ip-local>:5173/` (la IP que
   imprime Vite como "Network").
3. Chrome va a advertir por el certificado autofirmado: **Configuración
   avanzada → Continuar de todos modos**. Es solo el certificado de desarrollo
   de `@vitejs/plugin-basic-ssl`.
4. Acepta el permiso de cámara y apunta a cualquier código de barras.

Cada lectura vibra, pinta un flash verde y muestra **la cadena decodificada
cruda y el formato detectado** (`code_128`, `ean_13`, `qr_code`…). Eso es a
propósito: sirve para descubrir qué traen realmente las etiquetas de fábrica
(¿número de serie?, ¿modelo?, ¿UPC?) — está pendiente de validar (ver gotchas).

El contador "N por sincronizar" (arriba a la derecha) es un botón: lleva a
`/debug`, que lista la cola de eventos completa (uuid, tipo, serie, formato,
fecha, GPS, captura manual).

### Si el teléfono no carga la página

- **HTTPS es obligatorio**: `getUserMedia` (cámara) solo funciona en contexto
  seguro; `http://<ip>` nunca va a pedir permiso de cámara. Por eso existe
  `basic-ssl` en `vite.config.ts`.
- Windows Firewall puede estar bloqueando a Node en redes privadas — permite
  el acceso cuando lo pregunte, o revisa las reglas de entrada.
- Si hay VPN en la máquina (p. ej. NordVPN), puede bloquear conexiones
  entrantes de la LAN; activa "LAN discovery" o desconéctala para probar.
- Plan B sin red: conecta el teléfono por USB con depuración activada y corre
  `adb reverse tcp:5173 tcp:5173`; luego abre `https://localhost:5173` en el
  teléfono (localhost sí es contexto seguro).

---

## Estructura

```
src/
├── types/               Tipos del dominio
│   ├── estatus.ts       Unión de los 10 estatus del catálogo (no string)
│   ├── evento.ts        Evento (la unidad que se encola), TipoEvento, CoordenadasGps
│   ├── refrigerador.ts  Ficha del equipo (llave: numeroSerie)
│   └── barcode-detector.d.ts  Tipos de la API BarcodeDetector (no vienen en TS)
├── services/            ÚNICA puerta a capacidades del dispositivo (regla 1)
│   ├── index.ts         Punto de importación para toda la app; aquí se
│   │                    elegirá web/native con Capacitor.isNativePlatform()
│   ├── scanner.ts       Interfaz  │ scanner.web.ts   BarcodeDetector
│   ├── storage.ts       Interfaz  │ storage.web.ts   Cola de eventos en Dexie
│   ├── db.ts            Esquema Dexie (solo lo usa storage.web.ts)
│   ├── camera.ts        Interfaz  │ camera.web.ts    Stub (fotos: fase siguiente)
│   ├── location.ts      Interfaz  │ location.web.ts  navigator.geolocation
│   └── haptics.ts       Interfaz  │ haptics.web.ts   navigator.vibrate
├── hooks/
│   └── usePendientes.ts Cuenta reactiva de eventos sin sincronizar
├── components/
│   ├── ContadorPendientes.tsx  Badge siempre visible (regla 8); link a /debug
│   └── CapturaManual.tsx       Teclear serie a mano (regla 5)
└── pages/
    ├── EscaneoPage.tsx         Ruta /       — cámara + detección + encolado
    └── DebugColaPage.tsx       Ruta /debug  — inspección cruda de la cola
```

Regla de dependencias: `pages` y `components` importan **solo** de
`src/services` (el index), nunca una implementación `.web.ts` ni una API del
navegador directa. Si necesitas una capacidad nueva del dispositivo, crea un
servicio nuevo (interfaz + `.web.ts` + export en `index.ts`).

## Estado actual

**Hecho:**

- Scaffold Vite + React + TypeScript estricto + Tailwind 4 + react-router 7
- Capa de servicios completa con implementaciones web
- Cola de eventos offline en Dexie con UUID de idempotencia generado en cliente
- Pantalla de escaneo: preview fullscreen, detección continua con dedup de 2 s,
  captura manual siempre disponible, degradación cuando no hay `BarcodeDetector`
- Pantalla de depuración de la cola
- Contador de pendientes visible en todas las pantallas

**Falta (en orden aproximado):**

- Validar con etiquetas reales qué contiene el código de fábrica (gotcha
  abierto — puede ser modelo/lote/UPC y no la serie)
- Ficha del refrigerador: alta/apertura al escanear (Bloque 1)
- Diagnóstico con checklist y fotos (implementar `camera.web.ts`, cola de
  fotos separada de menor prioridad — regla 6)
- Derivación del estatus vigente reproduciendo eventos
- Flujo de salida/comodato, tránsito y entrega (Bloque 2)
- Sync con backend (ver TODOs) — no existe ni una línea de red todavía
- Advertencia al cerrar sesión con cola pendiente (no hay sesión aún)

## Dónde continuar (TODOs en el código)

- `src/services/index.ts` — **TODO(nativo):** selección web/native cuando
  entre Capacitor. Las `.native.ts` entran junto a cada `.web.ts`.
- `src/services/storage.ts` — **TODO(backend):** contrato del sync
  (`POST /eventos` en lote, idempotente por uuid). El sync será un módulo
  aparte; la cola no lo implementa.
- `src/services/camera.web.ts` — **TODO(fotos):** captura + compresión canvas.
- `src/types/evento.ts` y `EscaneoPage.tsx` — **TODO(auth):** `usuarioId`
  viene fijo en 0 hasta que exista sesión.

## Decisiones tomadas que no están en CLAUDE.md

- **HTTPS en dev con `@vitejs/plugin-basic-ssl`**: sin contexto seguro la
  cámara no funciona desde otra máquina de la red. Certificado autofirmado.
- **`ScannerService` es una sesión** (`iniciar(callback)` → `{stream, detener}`)
  y no el `escanear(): Promise<string>` bocetado en CLAUDE.md: la pantalla es
  de escaneo continuo y necesita el stream para el preview. En nativo (ML Kit)
  `stream` vendrá `undefined` porque el plugin dibuja su propia UI.
- **La lectura devuelve `{valorCrudo, formato}`** y el evento guarda
  `formatoCodigo`: es la herramienta para validar en bodega qué traen las
  etiquetas. Se puede quitar cuando eso quede resuelto.
- **Quinto servicio `haptics`**: la regla 1 prohíbe `navigator.vibrate` directo
  en una pantalla.
- **`sincronizado` se guarda como `0 | 1`**, no boolean: IndexedDB no acepta
  booleanos como llave de índice y la cola filtra por ese campo.
- **El escaneo de recepción intenta GPS 5 s (best-effort)** y encola sin GPS
  si no hay fix. El feedback visual es inmediato; solo el encolado espera.
- **`npm audit` reporta un CSRF en react-router**: aplica solo al modo RSC de
  servidor, que no se usa (ruteo 100% cliente); el "fix" es un downgrade.
