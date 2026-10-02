'use strict';

const handlers = {
  '/api/status': require('./status'),
  '/api/escaparate': require('./escaparate'),
  '/api/panel': require('./panel'),
  '/api/opiniones': require('./opiniones'),
  '/api/planes': require('./planes'),
  '/api/test-login': require('./test-login'),
  '/api/alta': require('./alta'),
  '/api/renovar': require('./renovar'),
  '/api/cancelar': require('./cancelar'),
  '/api/verificar': require('./verificar'),
  '/api/recompensas': require('./recompensas'),
  '/api/keys': require('./keys'),
  '/api/caminos': require('./caminos'),
  '/api/cuenta-joven': require('./cuenta-joven'),
  '/api/protecciones': require('./protecciones'),
  '/api/becas': require('./becas'),
  '/api/actividades': require('./actividades'),
  '/api/webhook': require('./webhook')
};

module.exports = async function apiRouter(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const handler = handlers[pathname];

  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  return handler(req, res);
};
