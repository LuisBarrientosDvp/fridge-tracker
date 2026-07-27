'use strict';

/**
 * Catálogos del dominio (spec §3 y §Roles). Cualquier valor fuera de estas
 * listas se rechaza en el backend — ocultar botones en el cliente no es
 * validación (regla 8).
 */

const ESTATUS_UBICACION = ['EN_ALMACEN', 'EN_UBICACION', 'EN_REPARACION'];
const ESTATUS_CONDICION = ['OPERATIVO', 'MANTENIMIENTO', 'REFURBISH', 'CHATARRA'];
const ROLES = ['TECNICO', 'ENCARGADO', 'ADMIN'];
const TIPOS_LUGAR = ['PUNTO_VENTA', 'TALLER'];

// minúsculas + sin acentos + espacios colapsados. La unicidad de Lugar
// (tipo + nombre_normalizado) se garantiza con esto en el backend: el Data
// Store no tiene índices únicos compuestos.
function normalizar(nombre) {
	return nombre
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ');
}

module.exports = { ESTATUS_UBICACION, ESTATUS_CONDICION, ROLES, TIPOS_LUGAR, normalizar };
