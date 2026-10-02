'use strict';

const TEST_MODE = String(process.env.PLACETAJOVEN_TEST_MODE || '1') === '1'
  && process.env.VERCEL_ENV !== 'production'
  && process.env.NODE_ENV !== 'production';

function dipNormalizado(value) {
  return String(value || '').trim().toUpperCase();
}

function estudiosConfigurados() {
  try {
    const parsed = JSON.parse(process.env.PLACETAJOVEN_STUDIOS_JSON || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function resolverPanel(registro) {
  const dip = dipNormalizado(registro && registro.dip);
  if (!dip) return { role: 'socio' };

  if (registro.test === true && TEST_MODE) {
    const testRole = String(process.env.PLACETAJOVEN_TEST_PANEL || 'admin').toLowerCase();
    if (testRole === 'admin') return { role: 'admin', test: true };
    if (testRole === 'studio') return { role: 'studio', studioId: 'test-studio', test: true };
  }

  const admins = String(process.env.PLACETAJOVEN_ADMIN_DIPS || '')
    .split(',').map(dipNormalizado).filter(Boolean);
  if (admins.includes(dip)) return { role: 'admin' };

  const studios = estudiosConfigurados();
  const studioId = studios[dip] || studios[dip.toLowerCase()];
  if (typeof studioId === 'string' && studioId.trim()) return { role: 'studio', studioId: studioId.trim() };

  return { role: 'socio' };
}

module.exports = { resolverPanel, dipNormalizado };