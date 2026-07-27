'use strict';

/**
 * Fridge Tracker — Advanced I/O Function (Express, la ÚNICA función del
 * proyecto). Organización:
 *
 *   rutas/       un módulo por recurso (codigos, equipos, lugares,
 *                almacenes, catalogos, usuarios, yo)
 *   lib/         zcql (esc/idValido/unwrap) · fechas (zona del proyecto) ·
 *                dominio (catálogos + normalizar) · movimientos (núcleo)
 *   middleware/  cors (solo dev) · auth (sesión → tabla Usuario) · roles
 *
 * Los permisos se validan aquí, no solo ocultando botones en el cliente
 * (regla 8). El header Authorization llega ya validado por el gateway.
 */

const express = require('express');

const app = express();
app.use(express.json());
app.use(require('./middleware/cors'));
app.use(require('./middleware/auth'));

app.use('/codigos', require('./rutas/codigos'));
app.use('/equipos', require('./rutas/equipos'));
app.use('/lugares', require('./rutas/lugares'));
app.use('/almacenes', require('./rutas/almacenes'));
app.use('/catalogos', require('./rutas/catalogos'));
app.use('/usuarios', require('./rutas/usuarios'));
app.use('/yo', require('./rutas/yo'));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Errores no atrapados (p. ej. JSON malformado en el body) → respuesta
// JSON, nunca la página HTML de error de Express.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	const status = err.type === 'entity.parse.failed' ? 400 : 500;
	res.status(status).json({ error: err.message || 'Error interno' });
});

module.exports = app;
