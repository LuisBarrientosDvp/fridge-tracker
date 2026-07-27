'use strict';

/**
 * Equipos (Refrigerador): alta en campo, listado con filtros/paginación,
 * ficha con historial, movimientos (2 ejes) y cambio de almacén (ADMIN).
 */

const crypto = require('crypto');
const router = require('express').Router();
const { esc, idValido, unwrap } = require('../lib/zcql');
const { ESTATUS_UBICACION, ESTATUS_CONDICION } = require('../lib/dominio');
const { ahora, comoFechaDataStore } = require('../lib/fechas');
const { movimientoPorUuid, validarCambio, verificarReferencias } = require('../lib/movimientos');
const { soloAdmin } = require('../middleware/roles');

// Ficha básica (equipo + códigos) a partir del id — para respuestas
// idempotentes donde el renglón ya existía.
async function fichaBasica(zcql, refriId) {
	const id = idValido(refriId);
	if (!id) return null;
	const refris = unwrap(
		await zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
		'Refrigerador'
	);
	if (refris.length === 0) return null;
	const codigos = unwrap(
		await zcql.executeZCQLQuery(`SELECT * FROM CodigoEquipo WHERE refrigerador_id = ${id}`),
		'CodigoEquipo'
	);
	return { equipo: refris[0], codigos };
}

// POST /equipos — alta en campo. Idempotente por uuid_cliente: el reintento
// de un alta que perdió la respuesta devuelve el equipo ya creado en vez de
// duplicarlo (el movimiento ALTA guarda el uuid).
router.post('/', async (req, res) => {
	const b = req.body || {};
	try {
		if (!b.marca || !b.equipo_tipo) {
			return res.status(400).json({ error: 'marca y equipo_tipo son obligatorios' });
		}

		if (b.uuid_cliente) {
			const previo = await movimientoPorUuid(req.zcql, b.uuid_cliente);
			if (previo) {
				const ficha = await fichaBasica(req.zcql, previo.refrigerador_id);
				if (ficha) {
					return res.status(200).json({ ...ficha, idempotente: true });
				}
			}
		}

		const almacenId = idValido(b.almacen_id) || idValido(req.usuario.almacen_id);
		if (!almacenId) {
			return res.status(400).json({ error: 'El usuario no tiene almacén base; envía almacen_id' });
		}

		// Los códigos son únicos globales: verificar ANTES de crear el refri
		// para no dejar un renglón huérfano si el código ya está ocupado.
		const codigosNuevos = [];
		if (b.serial) {
			codigosNuevos.push({
				codigo: b.serial,
				formato: b.formato_codigo || 'code_128',
				es_principal: true
			});
		}
		if (b.num_activo && b.num_activo !== b.serial) {
			codigosNuevos.push({ codigo: b.num_activo, formato: 'activo', es_principal: false });
		}
		for (const c of codigosNuevos) {
			const ocupados = unwrap(
				await req.zcql.executeZCQLQuery(
					`SELECT ROWID FROM CodigoEquipo WHERE codigo = '${esc(c.codigo)}'`
				),
				'CodigoEquipo'
			);
			if (ocupados.length > 0) {
				return res.status(409).json({ error: `El código ${c.codigo} ya está asignado a otro equipo` });
			}
		}

		const ds = req.app_catalyst.datastore();
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

		// Sin transacciones en el Data Store: si códigos o movimiento fallan
		// (p. ej. carrera contra el índice único), se compensa borrando lo ya
		// insertado para no dejar huérfanos.
		const codigosInsertados = [];
		try {
			for (const c of codigosNuevos) {
				codigosInsertados.push(
					await ds.table('CodigoEquipo').insertRow({
						refrigerador_id: nuevo.ROWID,
						...c,
						fecha_alta: ahora()
					})
				);
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
				lat: b.lat ?? null,
				lng: b.lng ?? null
			});
		} catch (err) {
			for (const c of codigosInsertados) {
				try { await ds.table('CodigoEquipo').deleteRow(c.ROWID); } catch (e) { /* mejor esfuerzo */ }
			}
			try { await ds.table('Refrigerador').deleteRow(nuevo.ROWID); } catch (e) { /* mejor esfuerzo */ }
			throw err;
		}

		res.status(201).json({ equipo: nuevo, codigos: codigosInsertados });
	} catch (err) {
		if (/unique|duplicate/i.test(err.message || '')) {
			// Carrera: puede ser el uuid del alta (reintento simultáneo) o un
			// código registrado por otro en medio de la verificación.
			if (b.uuid_cliente) {
				const ganador = await movimientoPorUuid(req.zcql, b.uuid_cliente).catch(() => null);
				if (ganador) {
					const ficha = await fichaBasica(req.zcql, ganador.refrigerador_id).catch(() => null);
					if (ficha) return res.status(200).json({ ...ficha, idempotente: true });
				}
			}
			return res.status(409).json({ error: 'Ese código ya está asignado a otro equipo' });
		}
		res.status(500).json({ error: err.message });
	}
});

// GET /equipos — lista con filtros y paginación (ZCQL limita filas por
// respuesta; con ~9,000 equipos reales la paginación es obligatoria).
router.get('/', async (req, res) => {
	try {
		const where = [];
		// ENCARGADO queda fijado a su almacén (§9): su filtro de query se
		// ignora, no se combina (combinar daría WHERE a=X AND a=Y → vacío).
		const almacenFiltro =
			req.usuario.rol === 'ENCARGADO' && req.usuario.almacen_id
				? idValido(req.usuario.almacen_id)
				: idValido(req.query.almacen_id);
		if (almacenFiltro) where.push(`almacen_id = ${almacenFiltro}`);
		if (req.query.estatus_ubicacion) {
			if (!ESTATUS_UBICACION.includes(req.query.estatus_ubicacion)) {
				return res.status(400).json({ error: 'estatus_ubicacion inválido' });
			}
			where.push(`estatus_ubicacion = '${esc(req.query.estatus_ubicacion)}'`);
		}
		if (req.query.estatus_condicion) {
			if (!ESTATUS_CONDICION.includes(req.query.estatus_condicion)) {
				return res.status(400).json({ error: 'estatus_condicion inválido' });
			}
			where.push(`estatus_condicion = '${esc(req.query.estatus_condicion)}'`);
		}
		if (req.query.q) {
			const q = esc(req.query.q);
			where.push(`(serial LIKE '%${q}%' OR num_activo LIKE '%${q}%' OR modelo LIKE '%${q}%')`);
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

// GET /equipos/:id — ficha + códigos + historial
router.get('/:id', async (req, res) => {
	try {
		const id = idValido(req.params.id);
		if (!id) return res.status(400).json({ error: 'id inválido' });
		const ficha = await fichaBasica(req.zcql, id);
		if (!ficha) return res.status(404).json({ error: 'Equipo no encontrado' });
		const movimientos = unwrap(
			await req.zcql.executeZCQLQuery(
				`SELECT * FROM Movimiento WHERE refrigerador_id = ${id} ORDER BY fecha_evento DESC LIMIT 0, 300`
			),
			'Movimiento'
		);
		res.json({ ...ficha, movimientos });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /equipos/:id/movimientos — cambio de ubicación y/o condición.
// Idempotente por uuid_cliente: repetido → 200 con el movimiento existente.
router.post('/:id/movimientos', async (req, res) => {
	try {
		const b = req.body || {};
		if (!b.uuid_cliente) return res.status(400).json({ error: 'uuid_cliente es obligatorio' });

		const existente = await movimientoPorUuid(req.zcql, b.uuid_cliente);
		if (existente) return res.status(200).json({ movimiento: existente, idempotente: true });

		const id = idValido(req.params.id);
		if (!id) return res.status(400).json({ error: 'id inválido' });
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
			'Refrigerador'
		);
		if (refris.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });

		const v = validarCambio(refris[0], b);
		if (v.error) return res.status(400).json({ error: v.error });

		// Regla 8: las referencias se validan aquí aunque el cliente ya filtre
		const errorRef = await verificarReferencias(req.zcql, v.cambios);
		if (errorRef) return res.status(400).json({ error: errorRef });

		const ds = req.app_catalyst.datastore();
		const mov = await ds.table('Movimiento').insertRow({
			refrigerador_id: id,
			uuid_cliente: b.uuid_cliente,
			...v.mov,
			nota: b.nota || null,
			usuario_id: String(req.usuario.catalyst_user_id),
			fecha_evento: comoFechaDataStore(b.fecha_evento),
			fecha_registro: ahora(),
			lat: b.lat ?? null,
			lng: b.lng ?? null
		});
		// Estatus denormalizado en Refrigerador (la verdad es el historial)
		await ds.table('Refrigerador').updateRow({ ROWID: id, ...v.cambios });

		res.status(201).json({ movimiento: mov });
	} catch (err) {
		if (/unique|duplicate/i.test(err.message || '')) {
			// Carrera con otro reintento del mismo uuid: devolver el que ganó
			const ganador = await movimientoPorUuid(req.zcql, req.body.uuid_cliente).catch(() => null);
			if (ganador) return res.status(200).json({ movimiento: ganador, idempotente: true });
		}
		res.status(500).json({ error: err.message });
	}
});

// PATCH /equipos/:id/almacen — cambio de almacén directo, solo ADMIN
router.patch('/:id/almacen', soloAdmin, async (req, res) => {
	try {
		const b = req.body || {};
		const almacenId = idValido(b.almacen_id);
		if (!almacenId) return res.status(400).json({ error: 'almacen_id inválido u omitido' });

		const id = idValido(req.params.id);
		if (!id) return res.status(400).json({ error: 'id inválido' });
		const refris = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT * FROM Refrigerador WHERE ROWID = ${id}`),
			'Refrigerador'
		);
		if (refris.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });

		const almacenes = unwrap(
			await req.zcql.executeZCQLQuery(`SELECT ROWID FROM Almacen WHERE ROWID = ${almacenId}`),
			'Almacen'
		);
		if (almacenes.length === 0) return res.status(400).json({ error: 'El almacén destino no existe' });

		const ds = req.app_catalyst.datastore();
		const mov = await ds.table('Movimiento').insertRow({
			refrigerador_id: id,
			uuid_cliente: b.uuid_cliente || crypto.randomUUID(),
			tipo_evento: 'TRASLADO',
			almacen_anterior_id: refris[0].almacen_id,
			almacen_nuevo_id: almacenId,
			nota: b.nota || null,
			usuario_id: String(req.usuario.catalyst_user_id),
			fecha_evento: comoFechaDataStore(b.fecha_evento),
			fecha_registro: ahora()
		});
		await ds.table('Refrigerador').updateRow({ ROWID: id, almacen_id: almacenId });
		res.json({ movimiento: mov });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
