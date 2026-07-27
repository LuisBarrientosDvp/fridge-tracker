'use strict';

/**
 * Usuarios (solo ADMIN): listar, invitar y administrar. La invitación usa
 * registerUser() de Authentication (correo para fijar contraseña) + renglón
 * en la tabla Usuario con rol/almacén.
 */

const router = require('express').Router();
const { esc, idValido, unwrap } = require('../lib/zcql');
const { ROLES } = require('../lib/dominio');
const { soloAdmin } = require('../middleware/roles');

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(soloAdmin);

// GET /usuarios — lista completa
router.get('/', async (req, res) => {
	try {
		const rows = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Usuario ORDER BY nombre LIMIT 0, 300`),
			'Usuario'
		);
		res.json({ data: rows });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /usuarios — invita por correo. Correo repetido en la tabla → 409;
// si ya existía en Authentication (invitado antes) se reutiliza su user_id.
router.post('/', async (req, res) => {
	try {
		const b = req.body || {};
		const correo = String(b.correo || '').trim().toLowerCase();
		const nombre = String(b.nombre || '').trim();
		if (!correo || !nombre || !b.rol) {
			return res.status(400).json({ error: 'correo, nombre y rol son obligatorios' });
		}
		if (!CORREO_VALIDO.test(correo)) {
			return res.status(400).json({ error: 'correo inválido' });
		}
		if (!ROLES.includes(b.rol)) {
			return res.status(400).json({ error: `rol inválido: ${b.rol}` });
		}
		if (b.almacen_id && !idValido(b.almacen_id)) {
			return res.status(400).json({ error: 'almacen_id inválido' });
		}
		const repetidos = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT ROWID FROM Usuario WHERE correo = '${esc(correo)}'`),
			'Usuario'
		);
		if (repetidos.length > 0) {
			return res.status(409).json({ error: 'Ese correo ya tiene un usuario en el sistema' });
		}

		const um = req.app_catalyst.userManagement();
		const partes = nombre.split(/\s+/);
		const userDetails = {
			first_name: partes[0],
			last_name: partes.slice(1).join(' ') || partes[0],
			email_id: correo
		};
		const redirect = `https://${req.headers.host}/app/index.html`;
		let catalystUser = null;
		let invitado = false;
		try {
			const r = await um.registerUser({ platform_type: 'web', redirect_url: redirect }, userDetails);
			catalystUser = r.user_details;
			invitado = true;
		} catch (e) {
			if (/redirect|pattern/i.test(e.message || '')) {
				// redirect_url rechazada: reintentar sin ella (la invitación llega igual)
				const r = await um.registerUser({ platform_type: 'web' }, userDetails);
				catalystUser = r.user_details;
				invitado = true;
			} else {
				// Probablemente ya existe en Authentication: reutilizar su user_id
				const todos = await um.getAllUsers();
				catalystUser = (todos || []).find(
					(u) => String(u.email_id || '').toLowerCase() === correo
				);
				if (!catalystUser) throw e;
			}
		}

		const fila = await req.app_catalyst.datastore().table('Usuario').insertRow({
			catalyst_user_id: String(catalystUser.user_id),
			nombre,
			correo,
			telefono: b.telefono || null,
			rol: b.rol,
			almacen_id: idValido(b.almacen_id),
			activo: true
		});
		res.status(201).json({ usuario: fila, invitado });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// PATCH /usuarios/:id — rol, almacén, activo, datos de contacto
router.patch('/:id', async (req, res) => {
	try {
		const id = idValido(req.params.id);
		if (!id) return res.status(400).json({ error: 'id inválido' });
		const filas = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Usuario WHERE ROWID = ${id}`),
			'Usuario'
		);
		if (filas.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
		const fila = filas[0];

		const b = req.body || {};
		const cambios = { ROWID: id };
		if (b.rol !== undefined) {
			if (!ROLES.includes(b.rol)) return res.status(400).json({ error: `rol inválido: ${b.rol}` });
			cambios.rol = b.rol;
		}
		if (b.almacen_id !== undefined) {
			if (b.almacen_id && !idValido(b.almacen_id)) {
				return res.status(400).json({ error: 'almacen_id inválido' });
			}
			cambios.almacen_id = idValido(b.almacen_id);
		}
		if (b.nombre !== undefined && String(b.nombre).trim()) cambios.nombre = String(b.nombre).trim();
		if (b.telefono !== undefined) cambios.telefono = b.telefono || null;
		if (b.activo !== undefined) cambios.activo = Boolean(b.activo);

		// Sin auto-lockout: un ADMIN no puede quitarse su propio acceso
		if (String(fila.catalyst_user_id) === String(req.usuario.catalyst_user_id)) {
			if ((cambios.rol && cambios.rol !== 'ADMIN') || cambios.activo === false) {
				return res.status(400).json({ error: 'No puedes quitarte tu propio acceso de ADMIN' });
			}
		}

		const actualizado = await req.app_catalyst.datastore().table('Usuario').updateRow(cambios);
		// Sincronizar enable/disable en Authentication (mejor esfuerzo: el
		// middleware ya rechaza a los inactivos aunque esto falle)
		if (b.activo !== undefined) {
			try {
				await req.app_catalyst
					.userManagement()
					.updateUserStatus(String(fila.catalyst_user_id), b.activo ? 'enable' : 'disable');
			} catch (e) {
				/* noop */
			}
		}
		res.json({ usuario: actualizado });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
