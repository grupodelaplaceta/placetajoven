// Placeta Joven — Lemon Squeezy (checkout y cancelación de suscripción)
'use strict';

const LS_API = 'https://api.lemonsqueezy.com/v1';

function conf() {
  return {
    apiKey: process.env.LS_API_KEY || '',
    storeId: process.env.LS_STORE_ID || '',
    variantMensual: process.env.LS_VARIANT_MENSUAL || '',
    variantAnual: process.env.LS_VARIANT_ANUAL || ''
  };
}

function tieneConf() {
  const c = conf();
  return !!(c.apiKey && c.storeId && c.variantMensual && c.variantAnual);
}

// Crea un checkout de Lemon Squeezy y devuelve la url de pago.
async function crearCheckout(plan, { dip, email, redirectUrl }) {
  if (!plan) throw new Error('plan_requerido');
  const c = conf();
  if (!c.apiKey || !c.storeId) throw Object.assign(new Error('no_config'), { code: 'NO_CONFIG' });
  const variant = plan === 'anual' ? c.variantAnual : c.variantMensual;
  if (!variant) throw Object.assign(new Error('no_config'), { code: 'NO_CONFIG' });

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        // IMPORTANTE: checkout_data es un OBJETO y product_options va a su lado
        // (en attributes), NO anidado dentro de checkout_data. Anidarlo ahí
        // hace que Lemon Squeezy rechace el checkout (422).
        checkout_data: {
          email: email || undefined,
          custom: { placeta_id: String(dip).trim().toUpperCase() }
        },
        product_options: {
          redirect_url: redirectUrl || (process.env.SITE_URL || 'https://joven.laplaceta.org') + '/mi.html?pago=ok'
        }
      },
      relationships: {
        store: { data: { type: 'stores', id: c.storeId } },
        variant: { data: { type: 'variants', id: variant } }
      }
    }
  };

  const res = await fetch(LS_API + '/checkouts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + c.apiKey,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error('ls_error_' + res.status), { code: 'LS_ERROR', detail: json });
  const url = json && json.data && json.data.attributes && json.data.attributes.url;
  if (!url) throw Object.assign(new Error('ls_sin_url'), { code: 'LS_ERROR' });
  return url;
}

// Cancela la suscripción en Lemon Squeezy (final de período) — best effort.
async function cancelarSuscripcion(subscriptionId) {
  const c = conf();
  if (!subscriptionId || !c.apiKey) return false;
  try {
    const res = await fetch(LS_API + '/subscriptions/' + encodeURIComponent(subscriptionId), {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + c.apiKey,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify({ data: { type: 'subscriptions', id: subscriptionId, attributes: { cancelled: true } } })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Busca en Lemon Squeezy una suscripción ACTIVA (o en prueba) del usuario por
// su email. Sirve para «reconciliar»: el usuario ya pagó pero el webhook no
// llegó y el doc sigue en PENDIENTE. Devuelve null si no hay suscripción.
async function buscarActivaPorEmail(email) {
  const c = conf();
  if (!c.apiKey || !c.storeId) throw Object.assign(new Error('no_config'), { code: 'NO_CONFIG' });

  const filtroEmail = String(email || '').trim().toLowerCase();
  if (!filtroEmail) return null;

  const url = LS_API + '/subscriptions'
    + '?filter[store_id]=' + encodeURIComponent(c.storeId)
    + '&filter[user_email]=' + encodeURIComponent(filtroEmail)
    + '&page[size]=10';
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + c.apiKey, Accept: 'application/vnd.api+json' }
  });
  if (!res.ok) {
    const err = new Error('ls_' + res.status);
    err.code = 'LS_ERROR';
    throw err;
  }
  const j = await res.json().catch(() => null);
  const items = (j && Array.isArray(j.data)) ? j.data : [];
  const activa = items.find((x) => x && x.attributes && /^(active|on_trial)$/i.test(String(x.attributes.status || '')));
  if (!activa) return null;
  const at = activa.attributes || {};
  return {
    subscriptionId: String(activa.id || ''),
    status: String(at.status || ''),
    variantId: String(at.variant_id || ''),
    renewsAt: at.renews_at || at.ends_at || null
  };
}

module.exports = { crearCheckout, cancelarSuscripcion, buscarActivaPorEmail, tieneConf };
