// Arcade Shield · comprueba EN EL SERVIDOR que un juego incrustado carga y permite ser embebido.
// Si falla, products.embed_ok = false y las sesiones web de ese juego no cuentan.
import { admin, cors, HttpError, json, requireUser } from '../_shared/common.ts';

const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://joven.laplaceta.org';

const privateIp = (ip: string) =>
  /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd');

async function safeUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.port && u.port !== '443') throw new Error('Solo https en el puerto 443');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) throw new Error('Host no permitido');
  const ips = [...await Deno.resolveDns(u.hostname, 'A').catch(() => []), ...await Deno.resolveDns(u.hostname, 'AAAA').catch(() => [])];
  if (!ips.length || ips.some(privateIp)) throw new Error('Host no resoluble o interno');
  return u;
}

async function probe(raw: string): Promise<string | null> {
  let url = await safeUrl(raw);
  for (let hop = 0; hop < 3; hop++) {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'PlacetaJoven-ArcadeShield/1.0' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = await safeUrl(new URL(r.headers.get('location')!, url).toString()); continue; }
    if (!r.ok) return `El servidor del juego responde ${r.status}`;
    const ct = r.headers.get('content-type') ?? '';
    if (!/text\/html/i.test(ct)) return 'La URL no devuelve una página HTML';
    const xfo = (r.headers.get('x-frame-options') ?? '').toLowerCase();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return 'El juego prohíbe ser incrustado (X-Frame-Options)';
    const fa = /frame-ancestors([^;]*)/i.exec(r.headers.get('content-security-policy') ?? '');
    if (fa && !/\*/.test(fa[1]) && !fa[1].includes(new URL(APP_ORIGIN).host)) return 'El juego prohíbe ser incrustado aquí (CSP frame-ancestors)';
    const body = (await r.text()).slice(0, 200_000);
    if (body.trim().length < 80) return 'La página del juego está vacía';
    return null;
  }
  return 'Demasiadas redirecciones';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { sb } = await requireUser(req);
    const { product_id } = await req.json().catch(() => ({}));
    const { data: p } = await sb.from('products').select('id, studio_id, embed_url').eq('id', product_id).maybeSingle();
    if (!p) throw new HttpError(404, 'PRODUCT_NOT_FOUND');
    const { data: member } = await sb.rpc('is_studio_member', { p_studio: p.studio_id });
    const { data: isAdm } = await sb.rpc('is_admin');
    if (!member && !isAdm) throw new HttpError(403, 'FORBIDDEN');
    let err: string | null = p.embed_url ? null : 'Sin URL de juego incrustado';
    if (!err) { try { err = await probe(p.embed_url!); } catch (e) { err = e instanceof Error ? e.message : 'No se pudo comprobar'; } }
    await admin().from('products').update({ embed_ok: !err, embed_checked_at: new Date().toISOString(), embed_error: err }).eq('id', p.id);
    return json(req, { ok: !err, error: err });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('check-embed', e instanceof Error ? e.message : e);
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
