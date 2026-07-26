# Fridge Tracker — cliente web (React + Catalyst)

Frontend del sistema de trazabilidad de refrigeradores. Este folder es la
**fusión** del mockup funcional v1 (`fridge-tracker-master`, construido con
Vite) con el scaffold de Web Client Hosting generado por `catalyst init`
(Create React App). El código fuente del mockup se portó completo a
`src/`; el build ahora lo hace el plugin de Catalyst
(`zcatalyst-cli-plugin-react`, basado en webpack/CRA), ya no Vite.

**Lee `../CLAUDE.md` antes de tocar el código.** Ahí están las reglas de
arquitectura no negociables, los gotchas conocidos, las decisiones de la
fusión y las preguntas abiertas. La especificación autoritativa del producto
es `../fridgetracker.md` (v3). El plan de trabajo pendiente está en
`../CHECKLIST.md`.

---

## Qué cambió respecto al mockup de Vite

| Pieza | Mockup (Vite) | Ahora (Catalyst/CRA) |
|---|---|---|
| Build | Vite 8 | webpack del plugin `zcatalyst-cli-plugin-react` / `react-scripts` |
| Entry | `index.html` + `src/main.tsx` | `public/index.html` + `src/index.tsx` |
| Tailwind | v4 (`@import 'tailwindcss'` vía plugin de Vite) | **v3** (`@tailwind base/components/utilities` + `tailwind.config.js`, modo PostCSS que el plugin de Catalyst detecta) |
| TypeScript | 7.x | **4.9** (límite de compatibilidad de react-scripts 5; babel solo quita tipos) |
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
npm install
npm start          # dev server CRA con HTTPS (ver .env)
```

También puedes servir vía Catalyst desde la raíz del proyecto:

```bash
catalyst serve
```

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

La página carga y la cola funciona, pero **no hay escaneo con cámara** (ningún
navegador de iOS implementa `BarcodeDetector`); la app cae a captura manual —
verificado en un iPhone 17 el 2026-07-25. WebKit además niega la
geolocalización con certificado autofirmado, así que en dev los eventos de
iPhone van sin GPS.

## Deploy a Catalyst (Web Client Hosting)

Desde la **raíz** del proyecto (`PACNOR DEMO/`, donde vive `catalyst.json`):

```bash
catalyst deploy
```

El plugin de React construye y sube el cliente. URL de desarrollo:
`https://demo-890811559.development.catalystserverless.com`

---

## Estructura

```
src/
├── types/               Tipos del dominio
│   ├── estatus.ts       ⚠️ Catálogo de 10 estatus del mockup — PENDIENTE de
│   │                    refactorizar al modelo de dos ejes de fridgetracker.md §3
│   ├── evento.ts        Evento (la unidad que se encola), TipoEvento, CoordenadasGps
│   ├── refrigerador.ts  Ficha del equipo (llave: numeroSerie)
│   └── barcode-detector.d.ts  Tipos de la API BarcodeDetector (no vienen en TS)
├── services/            ÚNICA puerta a capacidades del dispositivo (regla 1)
│   ├── index.ts         Punto de importación para toda la app
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

**Heredado del mockup (probado en campo 2026-07-25):**

- Android + Chrome: escaneo con cámara, vibración, flash, cadena cruda +
  formato, encolado en Dexie, contador y `/debug` — funciona completo.
- iPhone: degrada a captura manual como está diseñado.

**Hecho en la fusión (2026-07-26):**

- Código del mockup portado al scaffold de Catalyst (CRA): entry `index.tsx`,
  Tailwind v3, `tsconfig.json`, build verificado con `react-scripts build`.

**Falta — ver `../CHECKLIST.md` para la lista completa y el orden.** Los
puntos grandes: crear las 9 tablas del Data Store, la Advanced I/O Function
con los endpoints, login con Catalyst Auth, capa `api.ts`, refactor del
estatus a dos ejes, ficha del equipo, alta en campo, QR y tabla de
administración.

## Dónde continuar (TODOs en el código)

- `src/services/index.ts` — **TODO(nativo):** selección web/native cuando
  entre Capacitor.
- `src/services/storage.ts` — **TODO(backend):** contrato del sync
  (`POST /equipos/:id/movimientos`, idempotente por uuid).
- `src/services/camera.web.ts` — **TODO(fotos):** captura + compresión canvas.
- `src/types/evento.ts` y `EscaneoPage.tsx` — **TODO(auth):** `usuarioId`
  viene fijo en 0 hasta que exista sesión con Catalyst Auth.

## Decisiones heredadas del mockup que siguen vigentes

- **`ScannerService` es una sesión** (`iniciar(callback)` → `{stream, detener}`):
  la pantalla es de escaneo continuo y necesita el stream para el preview.
- **La lectura devuelve `{valorCrudo, formato}`** y el evento guarda
  `formatoCodigo`: herramienta para validar en bodega qué traen las etiquetas.
- **Quinto servicio `haptics`**: la regla 1 prohíbe `navigator.vibrate` directo.
- **`sincronizado` se guarda como `0 | 1`**, no boolean: IndexedDB no acepta
  booleanos como llave de índice.
- **El escaneo intenta GPS 5 s (best-effort)** y encola sin GPS si no hay fix.
