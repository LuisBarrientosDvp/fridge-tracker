'use strict';

/**
 * CORS solo para desarrollo. En producción cliente y función comparten
 * dominio (mismo proyecto Catalyst) y el navegador nunca pide CORS; esto
 * habilita únicamente el dev server local (https://localhost:3000 o
 * https://<ip-lan>:3000 desde el teléfono). Cualquier otro origen no recibe
 * cabeceras y el navegador lo bloquea.
 */

const ORIGEN_DEV = /^https?:\/\/[^/]+:3000$/;

module.exports = function cors(req, res, next) {
	const origin = req.headers.origin;
	if (origin && ORIGEN_DEV.test(origin)) {
		res.set('Access-Control-Allow-Origin', origin);
		res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, ZCSRF-TOKEN');
		res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
	}
	if (req.method === 'OPTIONS') return res.status(204).end();
	next();
};
