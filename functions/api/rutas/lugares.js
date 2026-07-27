'use strict';

/**
 * Lugares (PUNTO_VENTA y TALLER unificados). La deduplicación es por
 * nombre_normalizado: el cliente busca antes de habilitar "crear" y el
 * backend devuelve el existente si la normalización colisiona.
 */

const router = require('express').Router();
const { esc, unwrap } = require('../lib/zcql');
const { TIPOS_LUGAR, normalizar } = require('../lib/dominio');
const { ahora } = require('../lib/fechas');

// GET /lugares?tipo=&q= — búsqueda parcial por nombre normalizado
router.get('/', async (req, res) => {
	try {
		const where = [];
		if (req.query.tipo) where.push(`tipo = '${esc(req.query.tipo)}'`);
		if (req.query.q) where.push(`nombre_normalizado LIKE '%${esc(normalizar(req.query.q))}%'`);
		const sql =
			`SELECT * FROM Lugar` +
			(where.length ? ` WHERE ${where.join(' AND ')}` : '') +
			` ORDER BY nombre_normalizado LIMIT 0, 50`;
		res.json({ data: unwrap(await req.zcql.executeZCQLQuery(sql), 'Lugar') });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /lugares — crea; colisión de normalización → devuelve el existente
router.post('/', async (req, res) => {
	try {
		const b = req.body || {};
		if (!b.tipo || !b.nombre) {
			return res.status(400).json({ error: 'tipo y nombre son obligatorios' });
		}
		if (!TIPOS_LUGAR.includes(b.tipo)) {
			return res.status(400).json({ error: 'tipo debe ser PUNTO_VENTA o TALLER' });
		}
		const norm = normalizar(b.nombre);
		// Único compuesto (tipo + nombre_normalizado) garantizado aquí: el
		// Data Store no tiene índices únicos compuestos.
		const existentes = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Lugar WHERE tipo = '${esc(b.tipo)}' AND nombre_normalizado = '${esc(norm)}'`
			),
			'Lugar'
		);
		if (existentes.length > 0) {
			return res.status(200).json({ lugar: existentes[0], existente: true });
		}
		const lugar = await req.app_catalyst.datastore().table('Lugar').insertRow({
			tipo: b.tipo,
			nombre: b.nombre.trim(),
			nombre_normalizado: norm,
			calle: b.calle || null,
			numero_ext: b.numero_ext || null,
			numero_int: b.numero_int || null,
			colonia: b.colonia || null,
			municipio: b.municipio || null,
			estado: b.estado || null,
			cp: b.cp || null,
			referencia: b.referencia || null,
			lat: b.lat ?? null,
			lng: b.lng ?? null,
			contacto_nombre: b.contacto_nombre || null,
			contacto_telefono: b.contacto_telefono || null,
			creado_por: String(req.usuario.catalyst_user_id),
			fecha_creacion: ahora()
		});
		res.status(201).json({ lugar, existente: false });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
