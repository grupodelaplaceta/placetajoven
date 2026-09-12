'use strict';

const BASE = String(process.env.RSP_API_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.RSP_API_KEY || '');

async function obtenerValoracion(dip, caminoId, elementoId) {
  if (!BASE || !KEY) {
    const error = new Error('rsp_beca_no_configurada');
    error.code = 'rsp_beca_no_configurada';
    error.status = 503;
    throw error;
  }
  const query = new URLSearchParams({ dip, caminoId, elementoId });
  const response = await fetch(`${BASE}/publico/edu/placeta-joven/becas/valoracion?${query}`, {
    headers: { Accept: 'application/json', 'X-Placeta-Joven-Key': KEY }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.indicadores) {
    const error = new Error(data.error || 'rsp_valoracion_no_disponible');
    error.code = data.error || 'rsp_valoracion_no_disponible';
    error.status = response.status >= 500 ? 502 : response.status || 502;
    throw error;
  }
  return data;
}

module.exports = { obtenerValoracion };
