// Alta de claves por un estudio. Las claves entran cifradas y NUNCA se devuelven (ni en la respuesta ni en logs).
import { admin, cors, encryptKey, HttpError, json, keyHash, requireUser } from '../_shared/common.ts';

const MAX_BATCH = 500;
const RE = /^[A-Za-z0-9][A-Za-z0-9\-_.:]{4,127}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { sb, user } = await requireUser(req);
    const { product_id, keys } = await req.json().catch(() => ({}));
    if (typeof product_id !== 'string' || !Array.isArray(keys)) throw new HttpError(400, 'BAD_REQUEST');
    if (keys.length === 0 || keys.length > MAX_BATCH) throw new HttpError(400, 'BATCH_SIZE');

    // ¿El usuario pertenece al estudio dueño del juego? (RLS: solo ve productos de su estudio o publicados)
    const { data: p } = await sb.from('products').select('id, studio_id').eq('id', product_id).maybeSingle();
    if (!p) throw new HttpError(404, 'PRODUCT_NOT_FOUND');
    const { data: member } = await sb.rpc('is_studio_member', { p_studio: p.studio_id });
    const { data: isAdm } = await sb.rpc('is_admin');
    if (!member && !isAdm) throw new HttpError(403, 'FORBIDDEN');

    const sv = admin();
    const seen = new Set<string>(); let invalid = 0, dupInBatch = 0;
    const rows: Record<string, unknown>[] = [];
    for (const raw of keys) {
      const k = typeof raw === 'string' ? raw.trim() : '';
      if (!RE.test(k)) { invalid++; continue; }
      const h = await keyHash(k);
      if (seen.has(h)) { dupInBatch++; continue; }
      seen.add(h);
      rows.push({ product_id, key_cipher: await encryptKey(k, product_id), key_hash: h, key_last4: k.slice(-4), added_by: user.id });
    }
    let added = 0;
    if (rows.length) {
      const { data, error } = await sv.from('product_keys').upsert(rows, { onConflict: 'product_id,key_hash', ignoreDuplicates: true }).select('id');
      if (error) throw new HttpError(500, 'INSERT_FAILED');
      added = data?.length ?? 0;
    }
    await sv.from('key_audit').insert({ user_id: user.id, product_id, action: 'import', detail: { received: keys.length, added, invalid } });
    return json(req, { added, duplicates: rows.length - added + dupInBatch, invalid });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('studio-keys', e instanceof Error ? e.message : e);
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
