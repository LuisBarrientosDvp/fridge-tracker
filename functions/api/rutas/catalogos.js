'use strict';

/**
 * GET /catalogos?tipo= — valores activos del catálogo
 * (MARCA | MODELO | EQUIPO_TIPO | CERVEZA).
 */

const router = require('express').Router();
const { esc, unwrap } = require('../lib/zcql');

router.get('/', async (req, res) => {
	try {
		const where = ['activo = true'];
		if (req.query.tipo) where.push(`tipo_catalogo = '${esc(req.query.tipo)}'`);
		const rows = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Catalogo WHERE ${where.join(' AND ')} ORDER BY valor LIMIT 0, 300`
			),
			'Catalogo'
		);
		res.json({ data: rows });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
