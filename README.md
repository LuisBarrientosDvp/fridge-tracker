# ❄️ Fridge Tracker

Sistema de trazabilidad de refrigeradores en renta con publicidad para puntos
de venta de la Comarca Lagunera. PWA fullstack sobre **Zoho Catalyst**.

| | |
|---|---|
| **App (Development)** | https://demo-890811559.development.catalystserverless.com/app/index.html |
| **API** | `…/server/api/` (Advanced I/O Function, requiere sesión) |
| **Documento de contexto** | [`CLAUDE.md`](./CLAUDE.md) — especificación completa, arquitectura, gotchas y checklist |

## Qué hace

- **Login** con Catalyst Authentication; la primera pantalla siempre es el
  inicio de sesión.
- **Escaneo de códigos de barras y QR** con la cámara desde cualquier
  teléfono: Chrome/Android usa la API nativa `BarcodeDetector`; iPhone/iPad y
  navegadores sin la API usan el ponyfill [`barcode-detector`](https://www.npmjs.com/package/barcode-detector)
  (zxing-wasm). Captura manual siempre disponible.
- **Resolución del código** contra el inventario: si existe abre la ficha;
  si no, ofrece el **alta en campo** con el código precargado.
- **Ficha del equipo**: dos ejes de estatus (ubicación y condición),
  historial completo de movimientos, generación de **etiqueta QR** (PNG
  512px, contenido = serial).
- **Cambios de estatus** con validación en backend, idempotencia por UUID de
  cliente y GPS best-effort.
- **Ubicaciones** (puntos de venta y talleres) con búsqueda normalizada y
  deduplicación antes de crear.
- **Roles**: `ADMIN` (superadmin: reportes globales + todo), `ENCARGADO`
  (escanear + su almacén), `TECNICO` (solo escanear). Los permisos se validan
  en el backend, no solo en la interfaz.
- **Gestión de usuarios desde la app** (solo ADMIN): invitar por correo
  (Catalyst manda el email para fijar contraseña), asignar rol y almacén,
  desactivar/reactivar — sin tocar la consola de Catalyst.

## Diseño

Tema claro con marino `#1F3A5F` + cian `#12B5C9`, tarjetas blancas, pastillas
de estatus con punto de color y Roboto; la pantalla de escaneo es oscura con
brackets cian de encuadre. Las barras superiores muestran el tipo de
dispositivo (PC / Android / iOS / Móvil). Tokens en
`react-app/tailwind.config.js` (ver sección "Design system" de `CLAUDE.md`).

## Stack

React 19 + TypeScript + Tailwind (cliente, hosting web de Catalyst) ·
Node.js/Express en una Advanced I/O Function · Catalyst Data Store (9 tablas)
· Catalyst Authentication.

## Correr en local

```bash
cd react-app
npm install
npm start        # HTTPS en https://localhost:3000 (la cámara exige contexto seguro)
```

> El login solo funciona en la app publicada (el SDK de Catalyst lo sirve el
> hosting del proyecto). En local la app lo detecta y lo avisa.

## Desplegar

```bash
npm i -g zcatalyst-cli
catalyst login
catalyst deploy          # desde la raíz del repo (cliente + funciones)
```

## Estructura

```
├── CLAUDE.md            Documento único: spec v3, arquitectura, checklist
├── catalyst.json        Config del CLI de Catalyst
├── functions/api/       Advanced I/O Function (Express): todos los endpoints
└── react-app/           Cliente React (PWA)
    └── src/
        ├── pages/       Login, Menú, Escaneo, Ficha, Alta, Reportes, Almacén, Usuarios
        ├── components/  UI compartida, buscador de lugares, captura manual
        ├── services/    ÚNICA puerta a dispositivo y red (scanner, api, auth, device…)
        ├── context/     Sesión (estado de login + usuario + rol)
        └── types/       Dominio: dos ejes de estatus, formas de la API
```

---

Demo interno de PACNOR. Ver [`CLAUDE.md`](./CLAUDE.md) para el contexto
completo del proyecto, las reglas de arquitectura y lo que falta por
construir.
