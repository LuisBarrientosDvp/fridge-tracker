'use strict';

/**
 * GET /almacenes — catálogo de almacenes activos.
 */

const router = require('express').Router();
const { unwrap } = require('../lib/zcql');

router.get('/', async (req, res) => {
	try {
		const rows = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Almacen WHERE activo = true ORDER BY nombre LIMIT 0, 300`
			),
			'Almacen'
		);
		res.json({ data: rows });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
