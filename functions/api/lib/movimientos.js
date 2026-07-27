'use strict';

/**
 * Núcleo de movimientos. Movimiento es append-only: el estatus del refri es
 * denormalizado y se recalcula del último movimiento; el historial es el
 * producto (regla 2). uuid_cliente — generado en el dispositivo, nunca en
 * el servidor — es la llave de idempotencia (regla 3).
 */

const { esc, idValido, unwrap } = require('./zcql');
const { ESTATUS_UBICACION, ESTATUS_CONDICION } = require('./dominio');

async function movimientoPorUuid(zcql, uuidCliente) {
	const rows = unwrap(
		await zcql.executeZCQLQuery(
			`SELECT * FROM Movimiento WHERE uuid_cliente = '${esc(uuidCliente)}'`
		),
		'Movimiento'
	);
	return rows[0] || null;
}

// Valida los 2 ejes (§3) y arma los campos del refri + movimiento.
// EN_ALMACEN limpia lugar/reparación · EN_UBICACION exige lugar_id ·
// EN_REPARACION INTERNA (almacén opcional) o EXTERNA (exige lugar_id).
// Si cambian ambos ejes en un solo movimiento, gana el evento de ubicación.
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
	return { cambios, mov };
}

// Las referencias de un cambio (lugar_id, almacen_reparacion_id) se
// verifican contra el Data Store: id bien formado, renglón existente y tipo
// de lugar correcto (EN_UBICACION → PUNTO_VENTA, EXTERNA → TALLER).
// Devuelve el mensaje de error o null si todo está bien.
async function verificarReferencias(zcql, cambios) {
	if (cambios.lugar_actual_id) {
		const id = idValido(cambios.lugar_actual_id);
		if (!id) return 'lugar_id inválido';
		const lugares = unwrap(
			await zcql.executeZCQLQuery(`SELECT ROWID, tipo FROM Lugar WHERE ROWID = ${id}`),
			'Lugar'
		);
		if (lugares.length === 0) return 'El lugar indicado no existe';
		const tipoEsperado = cambios.reparacion_tipo === 'EXTERNA' ? 'TALLER' : 'PUNTO_VENTA';
		if (lugares[0].tipo !== tipoEsperado) {
			return `El lugar debe ser de tipo ${tipoEsperado}`;
		}
		cambios.lugar_actual_id = id;
	}
	if (cambios.almacen_reparacion_id) {
		const id = idValido(cambios.almacen_reparacion_id);
		if (!id) return 'almacen_reparacion_id inválido';
		const almacenes = unwrap(
			await zcql.executeZCQLQuery(`SELECT ROWID FROM Almacen WHERE ROWID = ${id}`),
			'Almacen'
		);
		if (almacenes.length === 0) return 'El almacén de reparación no existe';
		cambios.almacen_reparacion_id = id;
	}
	return null;
}

module.exports = { movimientoPorUuid, validarCambio, verificarReferencias };
