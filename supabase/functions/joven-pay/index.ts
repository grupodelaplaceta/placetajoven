// Dinero real: compras (cobro a la cuenta Joven → cuenta de Placeta Joven) y recompensas (recarga desde la cuenta de administración).
// Todas las llamadas al banco llevan Idempotency-Key derivada del pedido/recompensa: reintentar JAMÁS cobra ni abona dos veces.
import { admin, cors, env, HttpError, json, requireUser } from '../_shared/common.ts';
import { eligibleJoven, upstream } from '../_shared/bank.ts';

const codeOf = (m: string) => (/^[A-Z_]{3,40}$/.test(m) ? m : 'INTERNAL');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { sb, user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const sv = admin();
    const { data: p } = await sv.from('profiles').select('dip, joven_iban, birth_date').eq('id', user.id).single();
    if (!p || !p.dip || !p.joven_iban) throw new HttpError(409, 'NO_ACCOUNT');

    if (!eligibleJoven(p.birth_date)) throw new HttpError(422, 'NOT_ELIGIBLE');   // ni compras ni recompensas fuera de 16-31

    if (body.action === 'buy') {
      if (typeof body.product_id !== 'string') throw new HttpError(400, 'BAD_REQUEST');
      // 1) reserva clave y crea pedido 'pending' (comprueba plan, edad, stock, duplicados). Sin tocar dinero.
      const { data, error } = await sb.rpc('begin_order', { p_product: body.product_id, p_adult_ok: !!body.adult_ok });
      if (error) throw new HttpError(error.message.includes('PLAN_REQUIRED') ? 403 : 400, codeOf(error.message));
      const o = data[0];
      // 2) cobro idempotente: misma clave de pedido = nunca dos cobros
      let ref: string | null = null;
      if (o.o_price > 0) {
        try {
          const r = await upstream('POST', '/api/v1/bk/joven/pagos',
            { dip: p.dip, comercio_iban: env('PLACETAJOVEN_COMERCIO_IBAN'), importe: o.o_price, concepto: `Canje: ${o.o_title}`.slice(0, 80) },
            `pj-order-${o.o_order_id}`);
          ref = String(r.transaccion ?? r.id ?? '') || null;
        } catch (e) {
          if (e instanceof HttpError && (e.status === 422 || e.status === 400)) {          // el banco rechaza: se libera la clave
            await sv.rpc('finish_order', { p_order: o.o_order_id, p_ok: false, p_ref: null });
            throw new HttpError(402, 'PAYMENT_REFUSED');
          }
          throw new HttpError(502, 'PAYMENT_PENDING');    // no sabemos si cobró: el pedido queda pendiente y reintentar es seguro
        }
      }
      // 3) confirmar: la clave pasa a 'redeemed' y el jugador ya puede pedirla en reveal-key
      await sv.rpc('finish_order', { p_order: o.o_order_id, p_ok: true, p_ref: ref });
      return json(req, { order_id: o.o_order_id });
    }

    if (body.action === 'payout') {
      // Paga las recompensas ya validadas (tests, jugar, revisiones aprobadas) con recargas desde la cuenta de administración de Placeta Joven.
      const { data: claims } = await sv.from('claims').select('id, amount, concept')
        .eq('user_id', user.id).eq('status', 'confirmed').eq('payout_status', 'pending').order('id').limit(20);
      let paid = 0;
      for (const c of claims ?? []) {
        try {
          const r = await upstream('POST', '/api/v1/bk/joven/recargas',
            { origen_iban: env('PLACETAJOVEN_ORIGEN_IBAN'), dip: p.dip, importe: c.amount, concepto: (c.concept || 'Recompensa Placeta Joven').slice(0, 80) },
            `pj-claim-${c.id}`);
          await sv.from('claims').update({ payout_status: 'paid', payout_ref: String(r.transaccion ?? '') || null }).eq('id', c.id);
          paid++;
        } catch (_) { break; }     // saldo de administración insuficiente o cuenta congelada: queda pendiente y se reintenta luego
      }
      return json(req, { paid, pending: (claims?.length ?? 0) - paid });
    }
    throw new HttpError(400, 'UNKNOWN_ACTION');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('joven-pay', e instanceof Error ? e.message : e);
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
