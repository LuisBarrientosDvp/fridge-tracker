'use strict';

/**
 * Guardias de rol (§Roles). Siempre en el backend (regla 8): ocultar
 * botones en el cliente no es seguridad.
 */

function soloAdmin(req, res, next) {
	if (req.usuario.rol !== 'ADMIN') {
		return res.status(403).json({ error: 'Solo un ADMIN puede hacer esta operación' });
	}
	next();
}

module.exports = { soloAdmin };
