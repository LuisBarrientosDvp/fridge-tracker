'use strict';

/**
 * Autenticación y carga del usuario de dominio.
 * getCurrentUser() (scope usuario) identifica la sesión → se busca su
 * renglón en la tabla Usuario → 401 sin sesión / 403 sin renglón o
 * inactivo. El Data Store se toca SIEMPRE con scope admin: las tablas no
 * tienen permisos de App User, todo pasa por esta función.
 *
 * Deja en req: app_catalyst (app admin), zcql y usuario (renglón Usuario).
 */

const catalyst = require('zcatalyst-sdk-node');
const { esc, unwrap } = require('../lib/zcql');

module.exports = async function auth(req, res, next) {
	try {
		const userApp = catalyst.initialize(req);
		const currentUser = await userApp.userManagement().getCurrentUser();
		if (!currentUser || !currentUser.user_id) {
			return res.status(401).json({ error: 'No autenticado' });
		}
		const adminApp = catalyst.initialize(req, { scope: 'admin' });
		const zcql = adminApp.zcql();
		const rows = unwrap(
			await zcql.executeZCQLQuery(
				`SELECT * FROM Usuario WHERE catalyst_user_id = '${esc(currentUser.user_id)}'`
			),
			'Usuario'
		);
		if (rows.length === 0 || String(rows[0].activo) === 'false') {
			return res.status(403).json({
				error: 'Usuario no registrado o inactivo en la tabla Usuario',
				catalyst_user_id: String(currentUser.user_id)
			});
		}
		req.app_catalyst = adminApp;
		req.zcql = zcql;
		req.usuario = rows[0];
		next();
	} catch (err) {
		// Cualquier falla aquí (token vencido, SDK, ZCQL) se reporta como 401:
		// el cliente ya sabe arbitrar ese caso con isUserAuthenticated().
		return res.status(401).json({ error: 'Token inválido o expirado' });
	}
};
