// Placeta Joven — puente con la pasarela PlacetaID (plid26)
'use strict';

const BASE = String(process.env.PLACETAID_BASE_URL || 'https://id.laplaceta.org').replace(/\/+$/, '');

class GatewayError extends Error {
  constructor(code, status) {
    super(code || 'gateway_error');
    this.code = code;
    this.status = status || 502;
  }
}

// Valida el token de sesión del usuario contra la pasarela y devuelve su registro.
async function sesion(token) {
  if (!token) throw new GatewayError('token_requerido', 401);
  let res;
  try {
    res = await fetch(BASE + '/api/auth/session', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
    });
  } catch (e) {
    throw new GatewayError('gateway_no_disponible', 502);
  }
  if (res.status === 401 || res.status === 403) throw new GatewayError('sesion_invalida', 401);
  if (!res.ok) throw new GatewayError('gateway_' + res.status, 502);
  const data = await res.json().catch(() => null);
  const registro = data && data.registro;
  if (!registro || !registro.dip) throw new GatewayError('registro_no_encontrado', 404);
  return registro;
}

module.exports = { BASE, GatewayError, sesion };
