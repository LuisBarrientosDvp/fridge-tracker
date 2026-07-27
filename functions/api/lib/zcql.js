'use strict';

/**
 * Utilidades para ZCQL. Todo valor que se interpola en una consulta pasa
 * por esc() (texto) o idValido() (ids) — sin excepciones.
 */

// Escapa comillas simples para interpolar texto en ZCQL.
function esc(value) {
	return String(value).replace(/'/g, "''");
}

// Los ROWID de Catalyst (~17 dígitos) exceden Number.MAX_SAFE_INTEGER:
// Number() los redondea al double más cercano y la consulta busca OTRO
// renglón ("Equipo no encontrado" con un id válido). Los ids viajan siempre
// como string de dígitos validada y se interpolan tal cual en ZCQL.
// Nunca Number()/parseInt() sobre un ROWID.
function idValido(valor) {
	const s = String(valor === undefined || valor === null ? '' : valor).trim();
	return /^\d{1,20}$/.test(s) ? s : null;
}

// ZCQL envuelve cada renglón en { NombreTabla: {...} }; esto lo desenvuelve.
function unwrap(result, tableName) {
	return result.map((r) => r[tableName]).filter(Boolean);
}

module.exports = { esc, idValido, unwrap };
