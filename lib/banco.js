'use strict';

const BASE = String(process.env.PLACETA_BANCO_API_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.PLACETA_BANCO_API_KEY || '');

function configurado() {
  return /^https?:\/\//.test(BASE) && KEY.length > 10;
}

async function pedir(ruta, opciones) {
  if (!configurado()) {
    const error = new Error('banco_no_configurado');
    error.code = 'banco_no_configurado';
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY, ...(opciones && opciones.headers) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `banco_${response.status}`);
    error.code = data.error || `banco_${response.status}`;
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return data;
}

async function solicitarCuentaJoven(datos) {
  return pedir('/api/publico/cuenta-joven/solicitudes', { method: 'POST', body: JSON.stringify(datos) });
}

async function registrarRecompensa(datos) {
  return pedir('/api/publico/placetas/movimientos', { method: 'POST', body: JSON.stringify(datos) });
}

module.exports = { configurado, solicitarCuentaJoven, registrarRecompensa };
