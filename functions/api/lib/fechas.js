'use strict';

/**
 * Fechas del Data Store. Catalyst guarda datetimes en la zona del proyecto
 * (America/Mexico_City); el locale 'sv-SE' produce exactamente el formato
 * "YYYY-MM-DD HH:mm:ss" que la consola espera.
 */

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

// Acepta el ISO del cliente (fecha_evento, reloj del dispositivo — es la
// que manda en la lógica) y lo lleva al formato del Data Store. Valor
// ausente o inválido → hora del servidor.
function comoFechaDataStore(valor) {
	if (!valor) return ahora();
	const d = new Date(valor);
	if (isNaN(d.getTime())) return ahora();
	return formatoDataStore(d);
}

module.exports = { formatoDataStore, ahora, comoFechaDataStore };
