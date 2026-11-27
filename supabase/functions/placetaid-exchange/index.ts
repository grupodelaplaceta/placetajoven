// Canje del código de PlacetaID (solo servidor). El client_secret vive en los secretos de Supabase, nunca en el navegador.
// Devuelve una sesión de Supabase para el usuario identificado por PlacetaID.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { admin, cors, env, HttpError, json } from '../_shared/common.ts';

const EXCHANGE_URL = 'https://placetaid-web-plan2027.vercel.app/api/public/exchange';
const REDIRECT_URI = 'https://joven.laplaceta.org/placetaid';   // debe coincidir EXACTAMENTE con el callback registrado

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD');
    const { code } = await req.json().catch(() => ({}));
    if (typeof code !== 'string' || code.length < 8 || code.length > 512) throw new HttpError(400, 'BAD_CODE');
    // El `state` lo valida el navegador (sessionStorage) antes de llamar aquí.

    const r = await fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env('PLACETAID_CLIENT_ID'), client_secret: env('PLACETAID_CLIENT_SECRET'), code, redirect_uri: REDIRECT_URI }),
    });
    if (!r.ok) throw new HttpError(401, 'EXCHANGE_FAILED');
    const body = await r.json();

    // SUPUESTO (confírmalo con la doc de PlacetaID v27): la respuesta trae el usuario en `user` o en la raíz.
    const u = body.user ?? body.profile ?? body;
    const sub = String(u.sub ?? u.id ?? u.user_id ?? '');
    if (!sub) throw new HttpError(502, 'NO_SUBJECT');
    const name = String(u.name ?? u.full_name ?? [u.first_name, u.last_name].filter(Boolean).join(' ') ?? '').slice(0, 120);
    const dip = String(u.dip ?? u.DIP ?? '').trim();   // SUPUESTO: PlacetaID puede devolver el DIP
    const bd = String(u.fecha_nacimiento ?? u.birth_date ?? u.birthdate ?? ''); const birth = /^\d{4}-\d{2}-\d{2}$/.test(bd) ? bd : '';   // SUPUESTO de nombre del campo
    const email = String(u.email ?? `${sub}@placetaid.invalid`).toLowerCase();

    const sb = admin();
    // ¿ya existe un perfil enlazado a este sub?
    let { data: prof } = await sb.from('profiles').select('id').eq('placetaid_sub', sub).maybeSingle();
    let userId = prof?.id as string | undefined;
    if (!userId) {
      const created = await sb.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { placetaid_sub: sub, full_name: name, dip, birth_date: birth },
      });
      if (created.error || !created.data.user) throw new HttpError(500, 'CREATE_USER_FAILED');
      userId = created.data.user.id;
    }
    if (dip || birth) await sb.from('profiles').update({ ...(dip ? { dip } : {}), ...(birth ? { birth_date: birth } : {}) }).eq('id', userId);
    // Sesión: enlace mágico generado y canjeado en el servidor (el enlace no sale de aquí).
    const { data: link, error: le } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: (await sb.auth.admin.getUserById(userId)).data.user!.email!,
    });
    if (le || !link.properties?.hashed_token) throw new HttpError(500, 'LINK_FAILED');
    const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
    const { data: s, error: se } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    if (se || !s.session) throw new HttpError(500, 'SESSION_FAILED');
    return json(req, { access_token: s.session.access_token, refresh_token: s.session.refresh_token, expires_in: s.session.expires_in });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('placetaid-exchange', e instanceof Error ? e.message : e);   // nunca registrar código ni secreto
    return json(req, { error: e instanceof HttpError ? e.message : 'INTERNAL' }, status);
  }
});
