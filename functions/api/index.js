'use strict';

/**
 * Fridge Tracker — Advanced I/O Function (Express)
 * Endpoints según CLAUDE.md Parte II §6. Autenticación: token de
 * catalyst.auth.generateAuthToken() en el header Authorization.
 * Los permisos se validan aquí, no solo en la interfaz.
 */

const express = require('express');
const crypto = require('crypto');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

// CORS: en producción cliente y función comparten dominio (mismo proyecto);
// esto habilita el dev server local (https://localhost:3000).
app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin) {
		res.set('Access-Control-Allow-Origin', origin);
		res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
		res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
	}
	if (req.method === 'OPTIONS') return res.status(204).end();
	next();
});

// ---------- helpers ----------

const ESTATUS_UBICACION = ['EN_ALMACEN', 'EN_UBICACION', 'EN_REPARACION'];
const ESTATUS_CONDICION = ['OPERATIVO', 'MANTENIMIENTO', 'REFURBISH', 'CHATARRA'];

function esc(value) {
	return String(value).replace(/'/g, "''");
}

function normalizar(nombre) {
	return nombre
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ');
}

// El Data Store guarda datetimes en la zona del proyecto (America/Mexico_City)
function formatoDataStore(date) {
	return new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'America/Mexico_City',
		year: 'numeric', month: '2-digit', day: '2-digit',
		hour: '2-digit', minute: '2-digit', second: '2-digit',
		hour12: false
	}).format(date);
}

function ahora() {
	return formatoDataStore(new Date());
}

// Acepta ISO del cliente y lo lleva al formato del Data Store
function comoFechaDataStore(valor) {
	if (!valor) return ahora();
	const d = new Date(valor);
	if (isNaN(d.getTime())) return ahora();
	return formatoDataStore(d);
}

function unwrap(result, tableName) {
	return result.map((r) => r[tableName]).filter(Boolean);
}

// ---------- auth middleware ----------

app.use(async (req, res, next) => {
	try {
		const userApp = catalyst.initialize(req);
		const currentUser = await userApp.userManagement().getCurrentUser();
		if (!currentUser || !currentUser.user_id) {
			return res.status(401).json({ error: 'No autenticado' });
		}
		// Escritura/lectura del Data Store con scope admin: las tablas no
		// necesitan permisos de App User, todo pasa por esta función.
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
		return res.status(401).json({ error: 'Token inválido o expirado' });
	}
});

// ---------- movimientos: núcleo compartido ----------

async function movimientoPorUuid(zcql, uuidCliente) {
	const rows = unwrap(
		await zcql.executeZCQLQuery(
			`SELECT * FROM Movimiento WHERE uuid_cliente = '${esc(uuidCliente)}'`
		),
		'Movimiento'
	);
	return rows[0] || null;
}

// Valida las reglas de §3 y arma los campos del refri + movimiento
function validarCambio(refri, body) {
	const cambios = {};
	const mov = {};

	if (body.estatus_condicion !== undefined) {
		if (!ESTATUS_CONDICION.includes(body.estatus_condicion)) {
			return { error: `estatus_condicion inválido: ${body.estatus_condicion}` };
		}
		mov.tipo_evento = 'CAMBIO_CONDICION';
		mov.estatus_condicion_ant = refri.estatus_condicion;
		mov.estatus_condicion_nuevo = body.estatus_condicion;
		cambios.estatus_condicion = body.estatus_condicion;
	}

	if (body.estatus_ubicacion !== undefined) {
		if (!ESTATUS_UBICACION.includes(body.estatus_ubicacion)) {
			return { error: `estatus_ubicacion inválido: ${body.estatus_ubicacion}` };
		}
		mov.tipo_evento = body.estatus_ubicacion === 'EN_REPARACION' ? 'REPARACION' : 'CAMBIO_UBICACION';
		mov.estatus_ubicacion_ant = refri.estatus_ubicacion;
		mov.estatus_ubicacion_nuevo = body.estatus_ubicacion;
		cambios.estatus_ubicacion = body.estatus_ubicacion;

		if (body.estatus_ubicacion === 'EN_ALMACEN') {
			cambios.lugar_actual_id = null;
			cambios.reparacion_tipo = null;
			cambios.almacen_reparacion_id = null;
		} else if (body.estatus_ubicacion === 'EN_UBICACION') {
			if (!body.lugar_id) return { error: 'EN_UBICACION requiere lugar_id (PUNTO_VENTA)' };
			cambios.lugar_actual_id = body.lugar_id;
			cambios.reparacion_tipo = null;
			cambios.almacen_reparacion_id = null;
			mov.lugar_id = body.lugar_id;
		} else {
			// EN_REPARACION
			if (body.reparacion_tipo === 'INTERNA') {
				cambios.reparacion_tipo = 'INTERNA';
				cambios.lugar_actual_id = null;
				cambios.almacen_reparacion_id = body.almacen_reparacion_id || null;
			} else if (body.reparacion_tipo === 'EXTERNA') {
				if (!body.lugar_id) return { error: 'Reparación EXTERNA requiere lugar_id (TALLER)' };
				cambios.reparacion_tipo = 'EXTERNA';
				cambios.lugar_actual_id = body.lugar_id;
				cambios.almacen_reparacion_id = null;
				mov.lugar_id = body.lugar_id;
			} else {
				return { error: 'EN_REPARACION requiere reparacion_tipo INTERNA o EXTERNA' };
			}
			mov.reparacion_tipo = body.reparacion_tipo;
		}
	}

	if (!mov.tipo_evento) {
		return { error: 'Nada que cambiar: envía estatus_ubicacion y/o estatus_condicion' };
	}
	// Si cambian ambos ejes en un solo movimiento, gana el evento de ubicación
	return { cambios, mov };
}

// ---------- endpoints ----------

// GET /codigos/:codigo — resuelve un código escaneado
app.get('/codigos/:codigo', async (req, res) => {
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
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Refrigerador WHERE ROWID = ${Number(codigos[0].refrigerador_id)}`
			),
			'Refrigerador'
		);
		if (refris.length === 0) {
			return res.status(404).json({ error: 'Código huérfano: el equipo ya no existe' });
		}
		res.json({ equipo: refris[0], codigo: codigos[0] });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /equipos — alta en campo
app.post('/equipos', async (req, res) => {
	try {
		const b = req.body || {};
		if (!b.marca || !b.equipo_tipo) {
			return res.status(400).json({ error: 'marca y equipo_tipo son obligatorios' });
		}
		const ds = req.app_catalyst.datastore();
		const almacenId = b.almacen_id || req.usuario.almacen_id;
		if (!almacenId) {
			return res.status(400).json({ error: 'El usuario no tiene almacén base; envía almacen_id' });
		}
		const nuevo = await ds.table('Refrigerador').insertRow({
			serial: b.serial || null,
			num_activo: b.num_activo || null,
			marca: b.marca,
			modelo: b.modelo || null,
			equipo_tipo: b.equipo_tipo,
			anio: b.anio || null,
			cerveza: b.cerveza || null,
			almacen_id: almacenId,
			estatus_ubicacion: 'EN_ALMACEN',
			estatus_condicion: 'OPERATIVO',
			origen_registro: 'CAMPO',
			registrado_por: String(req.usuario.catalyst_user_id),
			fecha_registro: ahora(),
			fecha_ingreso_real: b.fecha_ingreso_real ? comoFechaDataStore(b.fecha_ingreso_real) : null
		});

		// Código principal (serial) y número de activo como segundo código
		const codigos = [];
		if (b.serial) {
			codigos.push(await ds.table('CodigoEquipo').insertRow({
				refrigerador_id: nuevo.ROWID,
				codigo: b.serial,
				formato: b.formato_codigo || 'code_128',
				es_principal: true,
				fecha_alta: ahora()
			}));
		}
		if (b.num_activo && b.num_activo !== b.serial) {
			codigos.push(await ds.table('CodigoEquipo').insertRow({
				refrigerador_id: nuevo.ROWID,
				codigo: b.num_activo,
				formato: 'activo',
				es_principal: false,
				fecha_alta: ahora()
			}));
		}

		await ds.table('Movimiento').insertRow({
			refrigerador_id: nuevo.ROWID,
			uuid_cliente: b.uuid_cliente || crypto.randomUUID(),
			tipo_evento: 'ALTA',
			estatus_ubicacion_nuevo: 'EN_ALMACEN',
			estatus_condicion_nuevo: 'OPERATIVO',
			usuario_id: String(req.usuario.catalyst_user_id),
			fecha_evento: comoFechaDataStore(b.fecha_evento),
			fecha_registro: ahora(),
			lat: b.lat || null,
			lng: b.lng || null
		});

		res.status(201).json({ equipo: nuevo, codigos });
	} catch (err) {
		// Índice único de CodigoEquipo.codigo violado → código ya usado
		if (/unique|duplicate/i.test(err.message || '')) {
			return res.status(409).json({ error: 'Ese código ya está asignado a otro equipo' });
		}
		res.status(500).json({ error: err.message });
	}
});

// GET /equipos — lista con filtros y paginación
app.get('/equipos', async (req, res) => {
	try {
		const where = [];
		if (req.query.almacen_id) where.push(`almacen_id = ${Number(req.query.almacen_id)}`);
		if (req.query.estatus_ubicacion) where.push(`estatus_ubicacion = '${esc(req.query.estatus_ubicacion)}'`);
		if (req.query.estatus_condicion) where.push(`estatus_condicion = '${esc(req.query.estatus_condicion)}'`);
		if (req.query.q) {
			const q = esc(req.query.q);
			where.push(`(serial LIKE '%${q}%' OR num_activo LIKE '%${q}%' OR modelo LIKE '%${q}%')`);
		}
		// ENCARGADO ve solo su almacén en la tabla de administración (§9)
		if (req.usuario.rol === 'ENCARGADO' && req.usuario.almacen_id) {
			where.push(`almacen_id = ${Number(req.usuario.almacen_id)}`);
		}
		const perPage = Math.min(Number(req.query.per_page) || 50, 300);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const offset = (page - 1) * perPage;
		const sql =
			`SELECT * FROM Refrigerador` +
			(where.length ? ` WHERE ${where.join(' AND ')}` : '') +
			` ORDER BY ROWID DESC LIMIT ${offset}, ${perPage}`;
		const rows = unwrap(await req.zcql.executeZCQLQuery(sql), 'Refrigerador');
		res.json({ data: rows, page, per_page: perPage, has_more: rows.length === perPage });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /equipos/:id — ficha + historial
app.get('/equipos/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
			'Refrigerador'
		);
		if (refris.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
		const codigos = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM CodigoEquipo WHERE refrigerador_id = ${id}`),
			'CodigoEquipo'
		);
		const movimientos = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Movimiento WHERE refrigerador_id = ${id} ORDER BY fecha_evento DESC LIMIT 0, 300`
			),
			'Movimiento'
		);
		res.json({ equipo: refris[0], codigos, movimientos });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /equipos/:id/movimientos — cambio de ubicación o condición
app.post('/equipos/:id/movimientos', async (req, res) => {
	try {
		const b = req.body || {};
		if (!b.uuid_cliente) return res.status(400).json({ error: 'uuid_cliente es obligatorio' });

		// Idempotencia: si el uuid ya existe, devolver el existente
		const existente = await movimientoPorUuid(req.zcql, b.uuid_cliente);
		if (existente) return res.status(200).json({ movimiento: existente, idempotente: true });

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
			'Refrigerador'
		);
		if (refris.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
		const refri = refris[0];

		const v = validarCambio(refri, b);
		if (v.error) return res.status(400).json({ error: v.error });

		const ds = req.app_catalyst.datastore();
		const mov = await ds.table('Movimiento').insertRow({
			refrigerador_id: id,
			uuid_cliente: b.uuid_cliente,
			...v.mov,
			nota: b.nota || null,
			usuario_id: String(req.usuario.catalyst_user_id),
			fecha_evento: comoFechaDataStore(b.fecha_evento),
			fecha_registro: ahora(),
			lat: b.lat || null,
			lng: b.lng || null
		});
		// Denormalizado en Refrigerador
		await ds.table('Refrigerador').updateRow({ ROWID: id, ...v.cambios });

		res.status(201).json({ movimiento: mov });
	} catch (err) {
		if (/unique|duplicate/i.test(err.message || '')) {
			// Carrera con otro reintento: devolver el que ganó
			const ganador = await movimientoPorUuid(req.zcql, req.body.uuid_cliente);
			if (ganador) return res.status(200).json({ movimiento: ganador, idempotente: true });
		}
		res.status(500).json({ error: err.message });
	}
});

// PATCH /equipos/:id/almacen — solo ADMIN
app.patch('/equipos/:id/almacen', async (req, res) => {
	try {
		if (req.usuario.rol !== 'ADMIN') {
			return res.status(403).json({ error: 'Solo un ADMIN puede cambiar el almacén' });
		}
		const b = req.body || {};
		if (!b.almacen_id) return res.status(400).json({ error: 'almacen_id es obligatorio' });

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
			'Refrigerador'
		);
		if (refris.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
		const refri = refris[0];

		const ds = req.app_catalyst.datastore();
		const mov = await ds.table('Movimiento').insertRow({
			refrigerador_id: id,
			uuid_cliente: b.uuid_cliente || crypto.randomUUID(),
			tipo_evento: 'TRASLADO',
			almacen_anterior_id: refri.almacen_id,
			almacen_nuevo_id: b.almacen_id,
			nota: b.nota || null,
			usuario_id: String(req.usuario.catalyst_user_id),
			fecha_evento: comoFechaDataStore(b.fecha_evento),
			fecha_registro: ahora()
		});
		await ds.table('Refrigerador').updateRow({ ROWID: id, almacen_id: b.almacen_id });
		res.json({ movimiento: mov });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /lugares?tipo=&q= — búsqueda con deduplicación
app.get('/lugares', async (req, res) => {
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

// POST /lugares — crea o devuelve el existente si la normalización colisiona
app.post('/lugares', async (req, res) => {
	try {
		const b = req.body || {};
		if (!b.tipo || !b.nombre) return res.status(400).json({ error: 'tipo y nombre son obligatorios' });
		if (!['PUNTO_VENTA', 'TALLER'].includes(b.tipo)) {
			return res.status(400).json({ error: 'tipo debe ser PUNTO_VENTA o TALLER' });
		}
		const norm = normalizar(b.nombre);
		// Único compuesto (tipo + nombre_normalizado) garantizado aquí, no en el Data Store
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
			lat: b.lat || null,
			lng: b.lng || null,
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

// GET /almacenes
app.get('/almacenes', async (req, res) => {
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

// GET /catalogos?tipo=
app.get('/catalogos', async (req, res) => {
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

// ---------- usuarios (solo ADMIN): invitar y administrar desde la app ----------

const ROLES = ['TECNICO', 'ENCARGADO', 'ADMIN'];

// GET /usuarios — lista completa
app.get('/usuarios', async (req, res) => {
	try {
		if (req.usuario.rol !== 'ADMIN') {
			return res.status(403).json({ error: 'Solo un ADMIN puede administrar usuarios' });
		}
		const rows = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Usuario ORDER BY nombre LIMIT 0, 300`),
			'Usuario'
		);
		res.json({ data: rows });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /usuarios — invita por correo (Catalyst Authentication manda el email
// de invitación para fijar contraseña) y crea el renglón con rol/almacén.
app.post('/usuarios', async (req, res) => {
	try {
		if (req.usuario.rol !== 'ADMIN') {
			return res.status(403).json({ error: 'Solo un ADMIN puede invitar usuarios' });
		}
		const b = req.body || {};
		const correo = String(b.correo || '').trim().toLowerCase();
		const nombre = String(b.nombre || '').trim();
		if (!correo || !nombre || !b.rol) {
			return res.status(400).json({ error: 'correo, nombre y rol son obligatorios' });
		}
		if (!ROLES.includes(b.rol)) {
			return res.status(400).json({ error: `rol inválido: ${b.rol}` });
		}
		const repetidos = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT ROWID FROM Usuario WHERE correo = '${esc(correo)}'`),
			'Usuario'
		);
		if (repetidos.length > 0) {
			return res.status(409).json({ error: 'Ese correo ya tiene un usuario en el sistema' });
		}

		// Alta en Authentication. Si el correo ya existía ahí (invitado antes),
		// se reutiliza su user_id y solo se crea el renglón.
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
			almacen_id: b.almacen_id || null,
			activo: true
		});
		res.status(201).json({ usuario: fila, invitado });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// PATCH /usuarios/:id — rol, almacén, activo, datos de contacto
app.patch('/usuarios/:id', async (req, res) => {
	try {
		if (req.usuario.rol !== 'ADMIN') {
			return res.status(403).json({ error: 'Solo un ADMIN puede administrar usuarios' });
		}
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
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
		if (b.almacen_id !== undefined) cambios.almacen_id = b.almacen_id || null;
		if (b.nombre !== undefined && String(b.nombre).trim()) cambios.nombre = String(b.nombre).trim();
		if (b.telefono !== undefined) cambios.telefono = b.telefono || null;
		if (b.activo !== undefined) cambios.activo = Boolean(b.activo);

		// Un ADMIN no puede quitarse su propio acceso (quedaría fuera el último)
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

// Info del usuario autenticado (útil para el login del cliente)
app.get('/yo', (req, res) => {
	res.json({ usuario: req.usuario });
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

module.exports = app;
