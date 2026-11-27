// Puente con la API de Placeta Joven (placetaone). La clave x-api-key vive SOLO aquí (secreto PLACETAONE_API_KEY).
// Lista cerrada de acciones; el cliente nunca elige ruta, IBAN ni DIP: salen del perfil del usuario autenticado.
// Permisos de la clave: joven:gestionar (consultar cuenta por DIP, abrir, comercios) y joven:leer (detalle y movimientos). Nada más.
import { admin, cors, HttpError, json, requireUser } from '../_shared/common.ts';
import { eligibleJoven, IBAN_RE, saveIban, upstream } from '../_shared/bank.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { user } = await requireUser(req);
    const { action } = await req.json().catch(() => ({}));
    const { data: p } = await admin().from('profiles').select('dip, joven_iban, birth_date').eq('id', user.id).single();
    if (!p) throw new HttpError(404, 'NO_PROFILE');

    if (action === 'account') {
      let iban = p.joven_iban as string | null, basic: Record<string, any> = {};
      if (!iban) {
        if (!p.dip) throw new HttpError(409, 'NO_DIP');
        try { basic = await upstream('GET', `/api/v1/bk/joven/cuentas?dip=${encodeURIComponent(p.dip)}`); }
        catch (e) { if (e instanceof HttpError && e.status === 404) return json(req, { account: null }); throw e; }
        iban = basic.iban; await saveIban(user.id, iban);
      }
      if (!iban || !IBAN_RE.test(iban)) throw new HttpError(502, 'UPSTREAM');
      // detalle (estado, congelada, elegible, disponible): requiere joven:leer; si falta el permiso, se devuelve lo básico
      const detail = await upstream('GET', `/api/v1/bk/joven/cuentas/${iban}`).catch(() => ({}));
      return json(req, { account: { iban, disponible: detail.disponible ?? basic.disponible ?? null, estado: detail.estado ?? null,
        congelada: detail.congelada ?? false, motivo_congelacion: detail.motivo_congelacion ?? null, elegible: detail.elegible ?? null } });
    }
    if (action === 'open_account') {
      if (p.joven_iban) throw new HttpError(409, 'ALREADY_EXISTS');
      if (!p.dip) throw new HttpError(409, 'NO_DIP');
      if (!p.birth_date) throw new HttpError(409, 'NO_BIRTHDATE');
      if (!eligibleJoven(p.birth_date)) throw new HttpError(422, 'NOT_ELIGIBLE');   // 16-31 años (hasta el 31-dic del año de los 31)          // la API exige fecha de nacimiento verificada
      const d = await upstream('POST', '/api/v1/bk/joven/cuentas', { dip: p.dip, fecha_nacimiento: p.birth_date });
      await saveIban(user.id, d.iban);
      return json(req, { ok: true });
    }
    if (action === 'movements') {
      if (!p.joven_iban) throw new HttpError(409, 'NO_ACCOUNT');
      const d = await upstream('GET', `/api/v1/bk/joven/cuentas/${p.joven_iban}/movimientos?limite=20`);
      return json(req, { movimientos: Array.isArray(d.movimientos) ? d.movimientos : [] });
    }
    if (action === 'shops') {
      const d = await upstream('GET', '/api/v1/bk/joven/comercios');
      return json(req, { comercios: Array.isArray(d.comercios) ? d.comercios : [] });
    }
    // pagos y recargas: NO cableados a propósito hasta decidir si los Pz de la tienda son el saldo de esta cuenta
    throw new HttpError(400, 'UNKNOWN_ACTION');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('joven-api', e instanceof Error ? e.message : e);
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
