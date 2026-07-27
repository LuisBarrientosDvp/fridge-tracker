'use strict';

/**
 * GET /codigos/:codigo — resuelve cualquier código escaneado (placa, número
 * de activo, QR) a la ficha del equipo. Un equipo tiene N códigos; la
 * unicidad vive en CodigoEquipo.codigo (único global).
 */

const router = require('express').Router();
const { esc, idValido, unwrap } = require('../lib/zcql');

router.get('/:codigo', async (req, res) => {
	try {
		const codigos = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM CodigoEquipo WHERE codigo = '${esc(req.params.codigo)}'`
			),
			'CodigoEquipo'
		);
		if (codigos.length === 0) {
			return res.status(404).json({ error: 'Equipo no registrado', codigo: req.params.codigo });
		}
		const refriId = idValido(codigos[0].refrigerador_id);
		const refris = refriId
			? unwrap(
				await req.zcql.executeZCQLQuery(
					`SELECT * FROM Refrigerador WHERE ROWID = ${refriId}`
				),
				'Refrigerador'
			)
			: [];
		if (refris.length === 0) {
			return res.status(404).json({ error: 'Código huérfano: el equipo ya no existe' });
		}
		res.json({ equipo: refris[0], codigo: codigos[0] });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
