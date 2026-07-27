'use strict';

/**
 * GET /yo — usuario autenticado (renglón de la tabla Usuario). Es la fuente
 * de verdad de la sesión para el cliente: 200 lista · 401/403 los arbitra
 * SesionContext.
 */

const router = require('express').Router();

router.get('/', (req, res) => {
	res.json({ usuario: req.usuario });
});

module.exports = router;
