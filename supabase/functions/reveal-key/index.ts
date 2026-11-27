// El comprador pide SU clave. Solo se descifra bajo demanda, para el dueño del pedido, con límite de frecuencia y auditoría.
import { admin, cors, decryptKey, HttpError, json, requireUser } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { sb, user } = await requireUser(req);
    const { order_id } = await req.json().catch(() => ({}));
    if (typeof order_id !== 'string') throw new HttpError(400, 'BAD_REQUEST');

    const { data: o } = await sb.from('orders').select('id, product_id, key_id').eq('id', order_id).eq('status', 'paid').maybeSingle(); // RLS: solo sus pedidos
    if (!o) throw new HttpError(404, 'ORDER_NOT_FOUND');
    const sv = admin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sv.from('key_audit').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('action', 'reveal').gte('at', since);
    if ((count ?? 0) >= 20) throw new HttpError(429, 'RATE_LIMIT');

    const { data: k } = await sv.from('product_keys').select('key_cipher').eq('id', o.key_id).single();
    const key = await decryptKey(k!.key_cipher, o.product_id);
    await sv.from('key_audit').insert({ user_id: user.id, product_id: o.product_id, key_id: o.key_id, action: 'reveal' });
    return json(req, { key });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('reveal-key', e instanceof Error ? e.message : e);
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
