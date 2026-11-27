/* v28 · capa real: Supabase + PlacetaID · perfil · panel de estudio · Arcade Shield en servidor
   Se carga después del script principal y reutiliza sus funciones (render, toast, state…).
   Sin config.js rellenado, solo añade las mejoras que no necesitan servidor (banners, perfil local, avisos de plan). */
(function () {
'use strict';
const C = window.PJ_CONFIG || {};
const REAL = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
const sb = REAL ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
  // sesión solo en sessionStorage (TECH-003) y sin detectar tokens en la URL
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
const PID = { base: 'https://placetaid-web-plan2027.vercel.app/', client: 'plid27_3mRLkTpOxHxGuYg2',
  redirect: 'https://joven.laplaceta.org/placetaid', signup: 'https://laplaceta.org' };
const MY = { studios: [], products: [], stats: {}, cur: null, stale: true };
const REV = {};                       // claves reveladas: solo en memoria, 60 s
const PJX = { loading: false, demoPay: true, ledger: [], banners: [] };
window.PJ = { real: REAL, sb, MY };
if (!REAL) {   // diagnóstico visible: por qué sigue en modo demostración
  const why = !(C.supabaseUrl && C.supabaseAnonKey) ? 'config.js está vacío (falta supabaseUrl / supabaseAnonKey)'
    : 'no se cargó la librería de Supabase (revisa la conexión o el bloqueo de cdn.jsdelivr.net)';
  console.warn('[PJ] Modo demostración: ' + why);
  window.addEventListener('DOMContentLoaded', () => {
    if (location.hostname === 'localhost' || location.protocol === 'file:' || /vercel\.app$|laplaceta\.org$/.test(location.hostname)) {
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1f1f;color:#fff;padding:8px 14px;font:13px system-ui;text-align:center';
      b.textContent = 'Modo demostración: ' + why + '. El login con PlacetaID no está activo.';
      document.body.appendChild(b);
    }
  });
}

/* ------------------------------------------------------------ utilidades */
const ERR = {
  PLAN_REQUIRED: 'Necesitas un plan activo para hacer esto. Elige uno en Planes.',
  AUTH_REQUIRED: 'Tu sesión ha caducado. Vuelve a entrar con PlacetaID.',
  INSUFFICIENT_PZ: 'No tienes Pz suficientes para este canje.',
  OUT_OF_STOCK: 'Agotado: no quedan claves de este juego.',
  ALREADY_OWNED: 'Ya tienes este juego.',
  ALREADY_CLAIMED: 'Ya cobraste esto o está pendiente de revisión.',
  DAILY_CAP: 'Has llegado al máximo de Pz de hoy. Vuelve mañana.',
  AGE_REQUIRED: 'Confirma que tienes 18 años o más.',
  EMBED_UNAVAILABLE: 'Este juego no está disponible en el navegador ahora mismo. No se cuenta tiempo.',
  NOT_ENOUGH_TIME: 'Aún no has jugado lo suficiente para cobrar.',
  DEMO_DISABLED: 'El pago simulado está desactivado.',
  DESKTOP_UNSUPPORTED: 'Este juego no cuenta desde la app de escritorio.',
  SESSION_BROKEN: 'Esta sesión se marcó como fallida y no cuenta.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  FORBIDDEN_FIELD: 'Ese dato no se puede cambiar desde aquí.',
  RATE_LIMIT: 'Demasiadas peticiones. Espera un poco.',
  BATCH_SIZE: 'Máximo 500 claves por envío.',
  NOT_ELIGIBLE: 'Placeta Joven es para personas de 16 a 31 años (hasta el 31 de diciembre del año en que cumples 31).',
  NO_ACCOUNT: 'Necesitas tu cuenta Placeta Joven. Ábrela en Perfil.',
  PAYMENT_REFUSED: 'El banco rechazó el cobro: saldo insuficiente o cuenta congelada.',
  PAYMENT_PENDING: 'No pudimos confirmar el cobro. Reintenta: no se cobrará dos veces.',
};
const errCode = e => { const m = String((e && (e.message || e.error)) || e || ''); return Object.keys(ERR).find(k => m.includes(k)) || null; };
function fail(e) {
  const k = errCode(e); console.warn('PJ', e);
  toast(k ? ERR[k] : 'No se pudo completar la acción. Inténtalo de nuevo.', 'dg');
  if (k === 'PLAN_REQUIRED') go('planes');
  if (k === 'AUTH_REQUIRED') { resetLocal(); render(); }
}
async function fnErr(error) { try { const j = await error.context.json(); return j.error || 'ERROR'; } catch (_) { return 'ERROR'; } }
const fnCall = async (name, body) => {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw new Error(await fnErr(error));
  return data;
};
const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const hrs = ms => { const h = (ms || 0) / 3600000; return h < 10 ? h.toFixed(1).replace('.', ',') : String(Math.round(h)); };

async function squareJpeg(file, px) {           // recorta a cuadrado y recodifica: elimina EXIF/GPS
  if (file.size > 8 * 1024 * 1024) return null;
  const bm = await createImageBitmap(file), s = Math.min(bm.width, bm.height);
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  cv.getContext('2d').drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, px, px);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
}

/* ------------------------------------------------------------ estilos */
const css = document.createElement('style');
css.textContent = `
.pbn{display:grid;gap:10px;margin-bottom:18px}
.pbn-i{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 20px;border-radius:16px;color:#fff;cursor:pointer;
 background-blend-mode:multiply;box-shadow:0 6px 20px rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12)}
.pbn-i b{display:block;font-size:18px}.pbn-i span{display:block;font-size:14px;opacity:.92;margin-top:2px}
.pbn-i em{font-style:normal;font-weight:800;background:#fff;color:#111;padding:8px 16px;border-radius:99px;font-size:14px}
.pfimg{width:96px;height:96px;border-radius:50%;object-fit:cover;flex:none;border:2px solid var(--bd)}
.av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.pfgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.pfgrid label,.sfm label{display:block;font-size:13px;font-weight:700;color:var(--mt);margin:0 0 6px}
.pfgrid input,.sfm input,.sfm textarea,.sfm select{width:100%}
.hours{display:flex;align-items:baseline;gap:8px}.hours b{font-size:34px;color:var(--g);font-variant-numeric:tabular-nums}
.asp{position:absolute;inset:0;display:grid;place-items:center;background:rgba(6,4,18,.86);z-index:5;text-align:center;padding:20px}
.sfm{display:grid;gap:14px}.sfm .two2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.sfm .two2{grid-template-columns:1fr}}
.kstat{display:flex;gap:16px;flex-wrap:wrap}.kstat div{background:var(--sf2);border:1px solid var(--bd);border-radius:12px;padding:10px 14px}
.kstat b{display:block;font-size:20px}
`;
document.head.appendChild(css);

/* ------------------------------------------------------------ estado local y arranque */
/** 16 años cumplidos y hasta el 31-dic del año en que se cumplen 31 (misma regla que el banco y la base de datos) */
function eligibleJoven(b, now = new Date()) {
  if (!b) return false;
  const [y, m, d] = String(b).slice(0, 10).split('-').map(Number);
  return new Date(y + 16, m - 1, d) <= now && now <= new Date(y + 31, 11, 31, 23, 59, 59);
}
function ineligibleGate() {
  const p = state.profile, noDate = !p.birth;
  return `<div class="card" style="max-width:540px;margin:60px auto"><h2 style="margin-top:0">${noDate ? 'Falta tu fecha de nacimiento' : 'Placeta Joven no está disponible para ti'}</h2>
   <p>${noDate ? 'Necesitamos tu fecha de nacimiento verificada en tu cuenta de PlacetaID para comprobar que puedes usar Placeta Joven.'
     : 'Placeta Joven es para personas de <b>16 a 31 años</b>. Puedes usarlo hasta el 31 de diciembre del año en que cumples 31.'}</p>
   <div class="acts"><button class="btn ghost" onclick="logout()">Cerrar sesión</button></div></div>`;
}
function resetLocal() {
  state.profile = null; state.balance = 0; state.orders = []; state.claims = {}; state.bankOps = {};
  MY.studios = []; MY.products = []; MY.stats = {}; MY.stale = true; PJX.ledger = [];
}
const FOLLOW = ['img', 'cap', 'bg', 'shots', 'logo', 'portrait', 'vids', 'warn', 'long', 'tags', 'req', 'langs', 'publisher', 'release', 'feat', 'rec', 'eur', 'yt', 'rating', 'nrat'];
function toProduct(r) {
  const seed = SEED.find(s => s.id === r.id) || {}, vis = {};
  FOLLOW.forEach(f => { if (seed[f] !== undefined) vis[f] = clone(seed[f]); });
  return Object.assign({ id: r.id, title: r.title, dev: r.studio_name, genre: r.genre, price: r.price_pz, disc: r.discount_pct,
    stock: r.stock, desc: r.description || '', platform: r.platform || '', pegi: r.pegi, adult: r.adult, trial: r.trial,
    url: r.itch_url || r.store_url || '', play: r.embed_url || undefined, exe: r.exe_match || undefined,
    ext: !!(r.embed_url || r.exe_match), c: PAL[hs(r.id) % PAL.length], cb: 2.5 }, vis, r.media || {});
}
async function avatarUrl(path) {
  if (!path) return '';
  const { data } = await sb.storage.from('avatars').createSignedUrl(path, 3600);
  return (data && data.signedUrl) || '';
}
async function jovenBalance() {          // los Pz son el disponible de la cuenta Placeta Joven (banco)
  try {
    const a = await fnCall('joven-api', { action: 'account' });
    PJX.joven = Object.assign(PJX.joven && !PJX.joven.loading ? PJX.joven : { mv: [] }, { acc: a.account || null });
    return a.account && a.account.disponible != null ? Number(a.account.disponible) : 0;
  } catch (_) { return 0; }
}
async function payoutNow(notify) {         // paga recompensas validadas (recarga idempotente) y actualiza el saldo real
  try {
    const r = await fnCall('joven-pay', { action: 'payout' });
    state.balance = await jovenBalance(); loadJoven();
    if (notify) toast(r.pending ? 'Recompensa registrada: se abonará en tu cuenta en breve.' : 'Pz abonadas en tu cuenta.', r.pending ? 'wn' : 'ok');
  } catch (e) { if (notify) fail(e); }
  render();
}
async function hydrate() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { resetLocal(); return false; }
  const now = new Date().toISOString();
  const [p, plans, bal, cat, ban, ord, clm, mem, sts, led, st] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('user_plans').select('plan,expires_at').eq('status', 'active').gt('expires_at', now),
    jovenBalance(), sb.from('catalog').select('*'),
    sb.from('banners').select('*').order('sort'), sb.rpc('my_orders'),
    sb.from('claims').select('claim_key,amount,status,created_at'),
    sb.from('studio_members').select('studio_id,role'), sb.from('studios').select('*'),
    sb.from('pz_ledger').select('delta,concept,created_at').order('created_at', { ascending: false }).limit(15),
    sb.from('app_settings').select('*')]);
  if (p.error) throw p.error;
  const pr = p.data, act = plans.data || [], mine = (mem.data || []).map(m => m.studio_id);
  const exp = act.map(a => a.expires_at).sort().pop();
  state.profile = { id: pr.id, name: pr.display_name || 'Jugador/a', fullName: pr.full_name, nickname: pr.nickname || '',
    birth: pr.birth_date, eligible: eligibleJoven(pr.birth_date), avatarPath: pr.avatar_path, avatarUrl: await avatarUrl(pr.avatar_path), email: pr.contact_email || '', phone: pr.phone || '',
    marketing: pr.marketing_opt_in, age14: pr.age14_confirmed, age18: pr.age18_confirmed, playedMs: Number(pr.played_ms),
    member: act.length > 0, plans: Object.fromEntries(act.map(a => [a.plan, true])), expires: exp ? exp.slice(0, 10) : '',
    admin: false /* el panel de administración local no está conectado (TECH-007): se gestiona por SQL */ };
  state.balance = bal || 0;
  state.products = (cat.data || []).map(toProduct);
  state.orders = (ord.data || []).map(o => ({ id: o.id, pid: o.product_id, title: o.title, dev: o.studio_name, price: o.price_pz,
    cur: 'Pz', status: 'Entregado', at: Date.parse(o.created_at), last4: o.key_last4 }));
  state.claims = {}; state.bankOps = {};
  (clm.data || []).forEach(c => {
    if (c.claim_key.startsWith('test:')) state.claims[c.claim_key.slice(5)] = { status: c.status === 'confirmed' ? 'confirmed' : 'pending', amount: c.amount };
    if (c.claim_key.startsWith('play:')) state.bankOps[`arc:${pr.id}:${c.claim_key.slice(5)}`] = { op: 'credit', amount: c.amount, concept: 'Arcade Shield', ref: 'SRV', at: Date.parse(c.created_at) };
  });
  (sts.data || []).forEach(s => { STUDIOS[s.name] = Object.assign(STUDIOS[s.name] || {}, { verified: s.verified, founded: s.founded, base: s.base, founders: s.founders, web: s.web, about: s.about, highlight: s.highlight }); });
  MY.studios = (sts.data || []).filter(s => mine.includes(s.id)); MY.cur = MY.cur || (MY.studios[0] && MY.studios[0].id); MY.stale = true;
  PJX.banners = ban.data || []; PJX.ledger = led.data || [];
  const dm = (st.data || []).find(x => x.key === 'demo_mode'); PJX.demoPay = !dm || dm.value === 'true';
  sendGamesToDesktop();
  loadJoven();
  setTimeout(() => payoutNow(false), 0);     // reintenta recompensas pendientes
  return true;
}
async function refreshMoney() {
  const [b, o, c] = await Promise.all([jovenBalance(), sb.rpc('my_orders'), sb.from('catalog').select('*')]);
  state.balance = b || 0;
  state.orders = (o.data || []).map(x => ({ id: x.id, pid: x.product_id, title: x.title, dev: x.studio_name, price: x.price_pz, cur: 'Pz', status: 'Entregado', at: Date.parse(x.created_at), last4: x.key_last4 }));
  if (c.data) state.products = c.data.map(toProduct);
}

/* ------------------------------------------------------------ PlacetaID */
function pidLogin() {
  if (!REAL) return toast('Falta configurar Supabase en config.js: la app sigue en modo demostración.', 'wn');
  if (location.protocol === 'file:') return toast('Inicia sesión desde joven.laplaceta.org (la app de escritorio carga esa web).', 'wn');
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  const st = [...a].map(b => b.toString(16).padStart(2, '0')).join('');       // state nuevo en cada intento
  sessionStorage.setItem('pj_pid_state', st);
  const u = new URL(PID.base);
  u.search = new URLSearchParams({ client_id: PID.client, redirect_uri: PID.redirect, service: 'general', state: st }).toString();
  location.href = u.toString();
}
async function pidCallback() {
  if (!location.pathname.endsWith('/placetaid')) return false;
  const q = new URLSearchParams(location.search), code = q.get('code'), st = q.get('state');
  const exp = sessionStorage.getItem('pj_pid_state'); sessionStorage.removeItem('pj_pid_state');
  history.replaceState(null, '', '/#inicio');                                   // el código no queda en la barra ni en el historial
  if (!code || !st || !exp || st !== exp) { toast('El inicio de sesión no es válido o ha caducado. Inténtalo de nuevo.', 'dg'); return true; }
  try {
    const r = await fetch(C.supabaseUrl + '/functions/v1/placetaid-exchange', { method: 'POST',
      headers: { 'content-type': 'application/json', apikey: C.supabaseAnonKey }, body: JSON.stringify({ code }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error || 'EXCHANGE');
    await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
  } catch (e) { console.warn(e); toast('No pudimos validar tu cuenta de PlacetaID. Inténtalo de nuevo.', 'dg'); }
  return true;
}
function accessHtml() {
  const body = REAL
    ? `<h2>Entra o crea tu cuenta</h2><p class="small">Usamos tu cuenta del Grupo de La Placeta: no creamos contraseñas nuevas.</p>
       <button class="btn g blk" onclick="PJ.login()">Entrar con PlacetaID</button>
       <p class="small" style="margin-top:14px">¿No tienes cuenta? Regístrate en el Grupo de La Placeta en <a href="${PID.signup}" target="_blank" rel="noopener">laplaceta.org</a> y vuelve aquí.</p>`
    : `<h2>Crea tu cuenta</h2><p class="small">Versión de demostración: tus datos se guardan solo en este navegador.</p>
       <label for="nm">¿Cómo te llamas?</label><input type="text" id="nm" maxlength="40" placeholder="Tu nombre" autocomplete="given-name" onkeydown="if(event.key==='Enter')registerGo()">
       <label class="ck"><input type="checkbox" id="rg-a"> Tengo 14 años o más, o cuento con el permiso de mi madre, padre o tutor.</label>
       <label class="ck"><input type="checkbox" id="rg-t"> Acepto los <a onclick="go('legal/terminos')">términos</a> y la <a onclick="go('legal/privacidad')">política de privacidad</a>.</label>
       <button class="btn g blk" onclick="registerGo()">Crear mi cuenta</button>`;
  return `<section class="lp-s"><div class="lp-w"><div class="card lp-reg" style="max-width:480px;margin:32px auto">${body}
    <p style="margin:18px 0 0"><a onclick="go('inicio')">← Volver al inicio</a></p></div></div></section>`;
}
function patchLogin() {
  const card = document.querySelector('.lp-reg'); if (!card || !REAL) return;
  card.innerHTML = `<h2>Entra con tu cuenta de PlacetaID</h2>
    <p class="small">Usamos tu cuenta del Grupo de La Placeta: no creamos contraseñas nuevas.</p>
    <button class="btn g blk" onclick="PJ.login()">Entrar con PlacetaID</button>
    <p class="small" style="margin-top:14px">¿No tienes cuenta? Regístrate en el Grupo de La Placeta en <a href="${PID.signup}" target="_blank" rel="noopener">laplaceta.org</a> y vuelve aquí.</p>`;
  const stk = document.querySelector('.lp-sticky .btn'); if (stk) stk.textContent = 'Entrar con PlacetaID';
}
if (REAL) registerGo = pidLogin;      // en demo se mantiene el registro local original

/* ------------------------------------------------------------ sesión */
const _logout = logout;
logout = async function () {
  if (!REAL) return _logout();
  try { await sb.auth.signOut(); } catch (_) {}
  resetLocal(); toast('Sesión cerrada.'); go('inicio');
};

/* ------------------------------------------------------------ guardas de plan y render */
const GATED = ['test', 'pagar', 'jugar'];
const _render = render;
render = function () {
  const [r, id] = (location.hash.slice(1) || 'inicio').split('/');
  if (PJX.loading) { $('#main').innerHTML = '<div class="pj-load" role="status"><i></i><span>Cargando…</span></div>'; return; }
  if (!state.profile && r === 'acceso') {            // «Crear cuenta / Entrar» vive en su propia pantalla, no en el inicio
    document.body.classList.add('out'); $('#side').innerHTML = ''; $('#tabs').innerHTML = '';
    $('#main').innerHTML = publicHeader() + accessHtml() + publicFooter(); paintIcons(); window.scrollTo(0, 0); return;
  }
  if (state.profile && r === 'acceso') history.replaceState(null, '', '#inicio');
  if (REAL && state.profile && !state.profile.age14) { document.body.classList.remove('out'); $('#main').innerHTML = ageGate(); return; }
  if (REAL && state.profile && state.profile.age14 && !state.profile.eligible && r !== 'legal') {   // fuera de edad: no puede ser Placeta Joven
    document.body.classList.remove('out'); $('#main').innerHTML = ineligibleGate(); return;
  }
  if (state.profile && !state.profile.member && GATED.includes(r)) {         // sin plan: error y a planes
    toast(ERR.PLAN_REQUIRED, 'dg'); history.replaceState(null, '', '#planes');
  }
  if (r === 'miestudio' && state.profile) {
    _render(); $('#main').innerHTML = studioPanel(id) + footerHtml(); paintIcons();
    if (MY.stale) { MY.stale = false; loadStudio().then(() => { if (location.hash.startsWith('#miestudio')) render(); }); }
    return;
  }
  _render();
  if (!state.profile && r !== 'acceso') { const reg = document.getElementById('registro'); if (reg) reg.remove(); }   // fuera el formulario del inicio
  patchAvatar(); postPlay();
};
function patchAvatar() {
  const u = state.profile && state.profile.avatarUrl; if (!u) return;
  document.querySelectorAll('#side .me .av').forEach(el => { el.innerHTML = `<img src="${esc(u)}" alt="">`; });
}
function ageGate() {
  return `<div class="card" style="max-width:520px;margin:60px auto"><h2 style="margin-top:0">Antes de empezar</h2>
   <label class="ck" style="display:flex;gap:10px;margin:14px 0"><input type="checkbox" id="ag14"> Tengo 14 años o más, o cuento con el permiso de mi madre, padre o tutor.</label>
   <label class="ck" style="display:flex;gap:10px;margin:14px 0"><input type="checkbox" id="agt"> Acepto los <a onclick="go('legal/terminos')">términos</a> y la <a onclick="go('legal/privacidad')">política de privacidad</a>.</label>
   <button class="btn g blk" onclick="PJ.confirmAge()">Continuar</button></div>`;
}
async function confirmAge() {
  if (!$('#ag14').checked || !$('#agt').checked) return toast('Marca las dos casillas para continuar.', 'wn');
  const { error } = await sb.from('profiles').update({ age14_confirmed: true }).eq('id', state.profile.id);
  if (error) return fail(error);
  state.profile.age14 = true; render();
}

/* ------------------------------------------------------------ compra, claves, planes */
const _buy = buy;
buy = async function (pid) {
  if (!REAL) return _buy(pid);
  const p = prod(pid);
  if (!p) return toast('Juego no disponible.', 'dg');
  if (!state.profile.member) return fail(new Error('PLAN_REQUIRED'));
  if (p.adult && !ageOk) return toast(ERR.AGE_REQUIRED, 'dg');
  if (!accepted) return toast('Acepta las condiciones de canje.', 'dg');
  try {
    if (p.adult) { const u = await sb.from('profiles').update({ age18_confirmed: true }).eq('id', state.profile.id); if (u.error) throw u.error; }
    await fnCall('joven-pay', { action: 'buy', product_id: pid, adult_ok: !!p.adult && ageOk });   // cobro en el banco, idempotente
    accepted = false; await refreshMoney();
    toast('Canje completado. Tu clave está en Mis claves.', 'ok'); go('recompensas');
  } catch (e) { fail(e); }
};
const _orders = orders;
orders = function () {
  if (!REAL) return _orders();
  if (!state.orders.length) return hd('Mis claves', 'Aquí aparecerán tus claves.') + `<div class="card empty"><button class="btn sm" onclick="go('tienda')">Ir a Diversión</button></div>`;
  return hd('Mis claves', `${state.orders.length} juegos`) + `<div class="orders">` + state.orders.map(o => {
    const k = REV[o.id];
    return `<article class="card"><div class="row"><div><b style="font-size:17px">${esc(o.title)}</b><div class="small">${new Date(o.at).toLocaleDateString('es-ES')} · ${fmt(o.price)} Pz</div></div><span class="pill ok">Entregado</span></div>
     <div class="key" style="margin-top:14px">${k ? esc(k) : '••••-••••-' + esc(o.last4)}</div>
     <div class="row" style="justify-content:flex-start;margin-top:14px"><button class="btn ghost sm" onclick="PJ.reveal('${o.id}')">${k ? 'Ocultar clave' : 'Ver clave'}</button>${k ? `<button class="btn ghost sm" onclick="PJ.copy('${o.id}')">Copiar</button>` : ''}</div></article>`;
  }).join('') + `</div><p class="small" style="margin-top:14px">Por seguridad, la clave se descifra solo cuando la pides y se oculta sola a los 60 segundos.</p>`;
};
async function revealKey(id) {
  if (REV[id]) { delete REV[id]; return render(); }
  try { const d = await fnCall('reveal-key', { order_id: id }); REV[id] = d.key; render();
    setTimeout(() => { delete REV[id]; if (location.hash === '#recompensas') render(); }, 60000);
  } catch (e) { fail(e); }
}
const copyRev = id => { try { navigator.clipboard.writeText(REV[id]).then(() => toast('Clave copiada', 'ok'), () => toast('No se pudo copiar', 'dg')); } catch (_) { toast('No se pudo copiar', 'dg'); } };

const _activate = activate;
activate = async function (k) {
  if (!k || !PLANS[k]) return go('planes');
  if (!REAL) return _activate(k);
  if (!PJX.demoPay) return toast('El pago con tarjeta aún no está conectado (TECH-002).', 'wn');
  const { error } = await sb.rpc('demo_activate_plan', { p_plan: k });
  if (error) return fail(error);
  await hydrate(); toast(PLANS[k].n + ' activado (pago simulado).', 'ok'); render();
};

/* Recompensas de tests: el servidor limita importe, repetición y tope diario (TECH-001: la corrección sigue en el cliente) */
const _bank = bank;
bank = function (op, key, amount, concept) {
  if (!REAL) return _bank(op, key, amount, concept);
  if (op === 'credit' && key.startsWith('act:')) {
    const r = _bank(op, key, amount, concept); if (r.dup || r.error) return r;
    const aid = key.split(':').slice(2).join(':');
    sb.rpc('claim_test_reward', { p_test: aid, p_amount: Math.round(amount), p_concept: concept }).then(({ error }) => {
      if (error) { delete state.bankOps[key]; state.balance = +(state.balance - amount).toFixed(2); delete state.claims[aid]; fail(error); render(); }
      else payoutNow(true);          // el banco abona; el saldo mostrado se corrige con el real
    });
    return r;
  }
  if (op === 'credit') return { error: 'Esta recompensa todavía no está conectada al servidor.' };
  return _bank(op, key, amount, concept);
};
const _submit = submit;
submit = function (aid) {
  const before = state.claims[aid] && state.claims[aid].status;
  _submit(aid);
  const c = state.claims[aid];
  if (REAL && c && c.status === 'review' && before !== 'review')              // intento con señales de ayuda: revisión manual en servidor
    sb.rpc('claim_test_reward', { p_test: aid, p_amount: Math.round(c.min), p_concept: 'Test (revisión): ' + c.title, p_evidence: c.ev || null, p_review: true }).then(({ error }) => { if (error) fail(error); });
};
const _sendOpinion = sendOpinion;
sendOpinion = function (pid) { if (REAL) return toast('El cashback por opinión llegará pronto al servidor.', 'wn'); return _sendOpinion(pid); };

/* ------------------------------------------------------------ banners */
const DEMO_BANNERS = [{ kind: 'blackfriday', locale: 'es', title: 'Black Friday en Placeta Joven', subtitle: 'Juegos indie con descuento hasta el lunes. Tus Pz rinden más.',
  cta_label: 'Ver ofertas', filter: 'Ofertas', color_from: '#111111', color_to: '#7B3FF2', starts_at: '2026-11-23', ends_at: '2026-12-01' }];
window.bannersHtml = function () {
  const now = Date.now(), lang = (navigator.language || 'es').slice(0, 2);
  const L = (REAL ? PJX.banners : DEMO_BANNERS).filter(b => Date.parse(b.starts_at) <= now && now <= Date.parse(b.ends_at) && (b.locale === 'es' || b.locale === lang)).slice(0, 3);
  if (!L.length) return '';
  return `<div class="pbn">${L.map(b => `<a class="pbn-i" style="background-image:linear-gradient(rgba(0,0,0,.22),rgba(0,0,0,.22)),linear-gradient(120deg,${esc(b.color_from)},${esc(b.color_to)})"
    data-f="${esc(b.filter)}" onclick="PJ.banner(this.dataset.f)" role="link"><div><b>${esc(b.title)}</b><span>${esc(b.subtitle || '')}</span></div><em>${esc(b.cta_label || 'Ver ofertas')}</em></a>`).join('')}</div>`;
};
const banner = f => { FILT.g = f || 'Ofertas'; updShop(); const g = document.getElementById('grid'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

/* ------------------------------------------------------------ Placeta Joven (banco) · solo vía la función joven-api */
const pick = (o, ...k) => { for (const x of k) if (o && o[x] != null) return o[x]; };
const maskIban = i => (i && i.length > 8) ? i.slice(0, 4) + ' •••• ' + i.slice(-4) : (i || '');
async function loadJoven() {
  if (!REAL) return;
  PJX.joven = { loading: true };
  try {
    const a = await fnCall('joven-api', { action: 'account' });
    let mv = [];
    if (a.account) { const m = await fnCall('joven-api', { action: 'movements' }).catch(() => null); mv = (m && m.movimientos) || []; }
    PJX.joven = { acc: a.account || null, mv: mv.slice(0, 8) };
  } catch (e) { PJX.joven = { error: e.message }; }
  if (location.hash === '#perfil') render();
}
async function openJoven() {
  try { await fnCall('joven-api', { action: 'open_account' }); toast('Cuenta Placeta Joven abierta.', 'ok'); await loadJoven(); }
  catch (e) {
    const M = { NO_DIP: 'Falta tu DIP: contacta con el Grupo de La Placeta.', NO_BIRTHDATE: 'Falta tu fecha de nacimiento verificada.',
      NOT_ELIGIBLE: 'Placeta Joven es para personas de 16 a 31 años.', BAD_REQUEST: 'La fecha de nacimiento no es válida.' };
    toast(M[e.message] || 'No se pudo abrir la cuenta ahora.', 'dg');
  }
}
function jovenCard() {
  if (!REAL) return '';
  const j = PJX.joven || {}, say = t => `<p class="small" style="margin:0">${t}</p>`;
  let b;
  if (!PJX.joven || j.loading) b = say('Consultando tu cuenta…');
  else if (j.error === 'NO_DIP') b = say('Aún no tenemos tu DIP, así que no podemos enlazar tu cuenta Placeta Joven.');
  else if (j.error) b = say('No pudimos consultar tu cuenta ahora mismo. Inténtalo más tarde.');
  else if (!j.acc) b = `<p style="margin:0 0 10px">Todavía no tienes cuenta Placeta Joven.</p><button class="btn g sm" onclick="PJ.openJoven()">Abrir mi cuenta</button>`;
  else {
    const a = j.acc, st = a.congelada ? pill('Congelada', 'wn') : (a.elegible === false ? pill('No elegible', 'wn') : pill('Activa', 'ok'));
    b = `<div class="row" style="justify-content:space-between;gap:14px;flex-wrap:wrap"><div><span class="small">IBAN</span><div style="font-weight:700">${esc(maskIban(a.iban))}</div>${st}</div>`
      + (a.disponible != null ? `<div class="hours"><b>${esc(String(a.disponible))}</b><span class="small">Pz disponibles</span></div>` : '') + `</div>`
      + (a.congelada && a.motivo_congelacion ? say(esc(a.motivo_congelacion)) : '')
      + (j.mv.length ? `<div class="tw" style="margin-top:12px"><table><tbody>${j.mv.map(m => `<tr><td class="small">${esc(String(m.fecha || '').slice(0, 10))}</td><td>${esc(String(m.concepto || ''))}${m.contraparte && m.contraparte.nombre ? `<div class="small">${esc(m.contraparte.nombre)}</div>` : ''}</td><td style="font-weight:700;color:${m.tipo === 'entrada' ? 'var(--g)' : 'var(--tx)'}">${m.tipo === 'entrada' ? '+' : '−'}${esc(String(m.importe ?? ''))}</td></tr>`).join('')}</tbody></table></div>` : '');
  }
  return sec('Cuenta Placeta Joven') + `<div class="card">${b}</div>`;
}

/* ------------------------------------------------------------ perfil */
profile = function () {
  const p = state.profile, studio = REAL && MY.studios.length;
  const av = p.avatarUrl ? `<img class="pfimg" src="${esc(p.avatarUrl)}" alt="Tu foto de perfil">` : `<div class="av big" style="width:96px;height:96px;font-size:30px">${initials(p.name)}</div>`;
  const mov = REAL ? PJX.ledger.map(v => ({ at: Date.parse(v.created_at), concept: v.concept, op: v.delta > 0 ? 'credit' : 'debit', amount: Math.abs(v.delta) }))
    : Object.values(state.bankOps).sort((a, b) => b.at - a.at).slice(0, 15);
  const f = (id, l, v, extra = '') => `<div><label for="${id}">${l}</label><input id="${id}" value="${esc(v || '')}" ${extra}></div>`;
  return hd('Perfil')
  + `<div class="card pf" style="gap:22px;flex-wrap:wrap">${av}<div style="flex:1;min-width:200px"><b style="font-size:20px">${esc(p.name)}</b><small style="display:block">${planLabel(p)}</small>
      <label class="btn ghost sm" style="margin-top:10px;cursor:pointer;display:inline-flex">Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="PJ.avatar(this)"></label></div>
     <div class="hours" title="Horas jugadas"><b>${hrs(p.playedMs)}</b><span class="small">h jugadas</span></div></div>`
  + sec('Tus datos')
  + `<div class="card"><div class="pfgrid">
      ${f('pf-name', 'Nombre completo', p.fullName || p.name, 'readonly aria-describedby="pf-nh"')}
      ${f('pf-nick', 'Apodo (opcional)', p.nickname, `maxlength="30" placeholder="${esc(p.fullName || p.name)}"`)}
      ${f('pf-mail', 'Correo de contacto', p.email, 'type="email" autocomplete="email" maxlength="120"')}
      ${f('pf-tel', 'Teléfono de contacto', p.phone, 'type="tel" autocomplete="tel" maxlength="20" placeholder="+34 600 000 000"')}</div>
     <p class="small" id="pf-nh" style="margin:10px 0 0">El nombre viene de tu cuenta de PlacetaID. Si dejas el apodo vacío, se usa tu nombre completo.</p>
     <label class="ck" style="display:flex;gap:10px;margin:16px 0 0"><input type="checkbox" id="pf-mk" ${p.marketing ? 'checked' : ''} style="width:18px;height:18px;flex:none"> Quiero recibir correos con promociones y novedades de Placeta Joven. Puedes cambiarlo cuando quieras.</label>
     <button class="btn g" style="margin-top:16px" onclick="PJ.saveProfile()">Guardar cambios</button></div>`
  + sec('Horas jugadas')
  + `<div class="card"><p style="margin:0 0 10px">Para contabilizar tus horas puedes <b>descargar la app de escritorio</b> (Windows). Algunos juegos pueden no ser compatibles, pero la mayoría suman a tus horas, incluidos los juegos que juegas incrustados en la plataforma.</p>
     <div class="acts"><button class="btn ghost sm" onclick="dlDesktop()">Descargar app de escritorio</button></div></div>`
  + `<div class="acts" style="margin-top:18px">${p.member ? '' : `<button class="btn g" onclick="go('planes')">Ver planes</button>`}
     ${studio ? `<button class="btn" onclick="go('miestudio')">Panel de estudio</button>` : ''}
     ${REAL ? '' : `<button class="btn ghost" onclick="toggleAdmin()">${p.admin ? 'Desactivar administrador' : 'Activar administrador (demo)'}</button>`}
     <button class="btn ghost" onclick="logout()">Cerrar sesión</button>
     <button class="btn ghost" onclick="go('legal/arcade')">Cómo funciona Arcade Shield</button>
     ${REAL ? '' : `<button class="btn danger" onclick="resetAll()">Borrar datos de prueba</button>`}</div>`
  + jovenCard()
  + (REAL ? '' : sec('Movimientos'))
  + (REAL ? '' : mov.length ? `<div class="card tw"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${mov.map(v => `<tr><td class="small">${new Date(v.at).toLocaleDateString('es-ES')}</td><td>${esc(v.concept)}</td><td style="font-weight:700;color:${v.op === 'credit' ? 'var(--g)' : 'var(--tx)'}">${v.op === 'credit' ? '+' : '−'}${fmt(v.amount)} Pz</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Sin movimientos todavía.</div>');
};
async function saveProfile() {
  const nick = $('#pf-nick').value.trim(), em = $('#pf-mail').value.trim(), ph = $('#pf-tel').value.trim(), mk = $('#pf-mk').checked;
  if (nick && (nick.length < 2 || nick.length > 30)) return toast('El apodo debe tener entre 2 y 30 caracteres.', 'dg');
  if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast('El correo de contacto no es válido.', 'dg');
  if (ph && !/^\+?[0-9 ]{6,20}$/.test(ph)) return toast('El teléfono solo puede llevar números, espacios y +.', 'dg');
  if (mk && !em) return toast('Para recibir promociones indica un correo de contacto.', 'wn');
  if (REAL) { const { error } = await sb.from('profiles').update({ nickname: nick || null, contact_email: em || null, phone: ph || null, marketing_opt_in: mk }).eq('id', state.profile.id); if (error) return fail(error); }
  Object.assign(state.profile, { nickname: nick, email: em, phone: ph, marketing: mk });
  state.profile.name = nick || state.profile.fullName || state.profile.name;
  save(); toast('Perfil guardado.', 'ok'); render();
}
async function pickAvatar(inp) {
  const f = inp.files && inp.files[0]; inp.value = '';
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('Usa una imagen JPG, PNG o WebP.', 'dg');
  let blob; try { blob = await squareJpeg(f, 256); } catch (_) {}
  if (!blob) return toast('No se pudo procesar la imagen (máx. 8 MB).', 'dg');
  if (REAL) {
    const path = `${state.profile.id}/avatar.jpg`;
    const up = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (up.error) return fail(up.error);
    const u = await sb.from('profiles').update({ avatar_path: path }).eq('id', state.profile.id); if (u.error) return fail(u.error);
    state.profile.avatarPath = path; state.profile.avatarUrl = await avatarUrl(path) + '&t=' + Date.now();
  } else {
    state.profile.avatarUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  }
  save(); toast('Foto actualizada.', 'ok'); render();
}

/* ------------------------------------------------------------ panel de estudio */
async function loadStudio() {
  if (!REAL || !MY.studios.length) return;
  const ids = MY.studios.map(s => s.id);
  const { data } = await sb.from('products').select('*').in('studio_id', ids).order('title');
  MY.products = data || [];
  const st = await Promise.all(ids.map(id => sb.rpc('studio_key_stats', { p_studio: id })));
  MY.stats = {}; st.forEach(r => (r.data || []).forEach(x => { MY.stats[x.product_id] = x; }));
}
const curStudio = () => MY.studios.find(s => s.id === MY.cur) || MY.studios[0];
function studioPanel(sub) {
  if (!REAL || !MY.studios.length) return hd('Panel de estudio') + `<div class="card empty">Tu cuenta no está vinculada a ningún estudio. Escríbenos para dar de alta tu estudio.</div>`;
  const S = curStudio();
  if (sub) return gameEditor(S, decodeURIComponent(sub));
  const f = (id, l, v, extra = '') => `<div><label for="${id}">${l}</label><input id="${id}" value="${esc(v || '')}" ${extra}></div>`;
  const logo = S.logo_path ? `<img class="pfimg" src="${esc(sb.storage.from('studio-logos').getPublicUrl(S.logo_path).data.publicUrl)}" alt="Logo del estudio">` : `<div class="av big" style="width:96px;height:96px;font-size:30px">${ab(S.name)}</div>`;
  return hd('Panel de estudio', esc(S.name) + (S.verified ? ' · ficha verificada' : ' · ficha pendiente de verificar'))
   + (MY.studios.length > 1 ? `<div class="card" style="margin-bottom:14px"><select onchange="PJ.pickStudio(this.value)" aria-label="Estudio">${MY.studios.map(s => `<option value="${s.id}" ${s.id === S.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>` : '')
   + sec('Perfil del estudio')
   + `<div class="card sfm"><div class="row" style="justify-content:flex-start;gap:18px">${logo}<label class="btn ghost sm" style="cursor:pointer">Cambiar logo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="PJ.logo(this)"></label></div>
      <div><label for="sp-about">Descripción</label><textarea id="sp-about" rows="4" maxlength="1200">${esc(S.about || '')}</textarea></div>
      <div><label for="sp-hl">Dato destacado</label><input id="sp-hl" maxlength="300" value="${esc(S.highlight || '')}"></div>
      <div class="two2">${f('sp-web', 'Web (https://…)', S.web, 'type="url"')}${f('sp-found', 'Fundación', S.founded, 'maxlength="20"')}${f('sp-base', 'Sede', S.base, 'maxlength="80"')}${f('sp-fnd', 'Fundadores', S.founders, 'maxlength="200"')}</div>
      <div><button class="btn g" onclick="PJ.saveStudio()">Guardar perfil</button></div></div>`
   + sec('Tus juegos', `<button class="btn sm" onclick="PJ.newGame()">Añadir juego</button>`)
   + (MY.products.filter(p => p.studio_id === S.id).length ? `<div class="card tw"><table><thead><tr><th>Juego</th><th>Estado</th><th>Claves libres</th><th>Canjeadas</th><th></th></tr></thead><tbody>${MY.products.filter(p => p.studio_id === S.id).map(p => { const k = MY.stats[p.id] || {};
      return `<tr><td><b>${esc(p.title)}</b></td><td>${p.status === 'published' ? pill('Publicado', 'ok') : pill('Borrador')}</td><td>${k.available ?? 0}</td><td>${k.redeemed ?? 0}</td><td><button class="btn ghost sm" onclick="go('miestudio/${encodeURIComponent(p.id)}')">Editar</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card empty">Todavía no tienes juegos. Pulsa «Añadir juego».</div>');
}
function gameEditor(S, pid) {
  const p = MY.products.find(x => x.id === pid && x.studio_id === S.id);
  if (!p) return hd('Juego') + `<div class="card empty">No encontramos este juego. <button class="btn sm" onclick="go('miestudio')">Volver</button></div>`;
  const k = MY.stats[p.id] || {}, v = (id, l, val, extra = '') => `<div><label for="${id}">${l}</label><input id="${id}" value="${esc(val ?? '')}" ${extra}></div>`;
  return hd(esc(p.title), p.status === 'published' ? 'Publicado' : 'Borrador: el equipo de Placeta Joven lo publicará tras revisarlo.', `<button class="btn ghost sm" onclick="go('miestudio')">Volver</button>`)
   + `<div class="card sfm">
      ${v('ge-title', 'Título', p.title, 'maxlength="120"')}
      <div><label for="ge-desc">Descripción</label><textarea id="ge-desc" rows="4" maxlength="2000">${esc(p.description || '')}</textarea></div>
      <div class="two2">${v('ge-genre', 'Género', p.genre, 'maxlength="40"')}${v('ge-plat', 'Plataforma', p.platform, 'maxlength="40"')}
        ${v('ge-price', 'Precio en Pz (incluye el 12 % de comisión del Grupo de La Placeta)', p.price_pz, 'type="number" min="0" max="100000" step="1"')}${v('ge-disc', 'Descuento %', p.discount_pct, 'type="number" min="0" max="90" step="1"')}
        <div><label for="ge-pegi">PEGI</label><select id="ge-pegi"><option value="">Sin clasificar</option>${[3, 7, 12, 16, 18].map(n => `<option ${p.pegi === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="ck" style="display:flex;gap:10px;margin-top:26px"><input type="checkbox" id="ge-adult" ${p.adult ? 'checked' : ''} style="width:18px;height:18px"> Contenido para mayores de 18</label></div></div>
      <p class="small" style="margin:0">Con este precio recibirás el 88 % de cada canje.</p>
      <div class="two2">${v('ge-itch', 'Página en itch.io (https://…)', p.itch_url, 'type="url"')}${v('ge-store', 'Otra tienda (https://…)', p.store_url, 'type="url"')}
        ${v('ge-embed', 'URL del juego jugable en navegador (https://…)', p.embed_url, 'type="url"')}${v('ge-exe', 'Nombre del proceso en Windows (sin .exe)', p.exe_match, 'maxlength="40"')}</div>
      <div class="row" style="justify-content:flex-start;gap:10px;flex-wrap:wrap"><button class="btn g" onclick="PJ.saveProduct('${esc(p.id)}')">Guardar juego</button>
        <button class="btn ghost" onclick="PJ.checkEmbed('${esc(p.id)}')">Comprobar juego en navegador</button>
        ${p.embed_url ? (p.embed_ok ? pill('Embed verificado', 'ok') : pill(esc(p.embed_error || 'Sin verificar'), 'wn')) : ''}</div></div>`
   + sec('Claves')
   + `<div class="card sfm"><div class="kstat"><div><span class="small">Libres</span><b>${k.available ?? 0}</b></div><div><span class="small">Canjeadas</span><b>${k.redeemed ?? 0}</b></div><div><span class="small">Retiradas</span><b>${k.revoked ?? 0}</b></div></div>
      <div><label for="kx">Añadir claves (una por línea, máx. 500)</label><textarea id="kx" rows="6" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX"></textarea></div>
      <p class="small" style="margin:0">Las claves se cifran en el servidor nada más enviarlas. <b>Nunca se vuelven a mostrar</b>, ni a ti: solo ves cuántas quedan. Solo el jugador que las canjea puede verlas.</p>
      <div><button class="btn g" onclick="PJ.addKeys('${esc(p.id)}')">Añadir claves cifradas</button></div></div>`;
}
const val = id => ($('#' + id) || {}).value || '';
async function saveStudio() {
  const S = curStudio(), web = val('sp-web').trim();
  if (web && !/^https:\/\//.test(web)) return toast('La web debe empezar por https://', 'dg');
  const row = { about: val('sp-about').trim() || null, highlight: val('sp-hl').trim() || null, web: web || null, founded: val('sp-found').trim() || null, base: val('sp-base').trim() || null, founders: val('sp-fnd').trim() || null };
  const { error } = await sb.from('studios').update(row).eq('id', S.id); if (error) return fail(error);
  Object.assign(S, row); STUDIOS[S.name] = Object.assign(STUDIOS[S.name] || {}, row); toast('Perfil del estudio guardado.', 'ok'); render();
}
async function pickLogo(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  let blob; try { blob = await squareJpeg(f, 256); } catch (_) {} if (!blob) return toast('No se pudo procesar la imagen.', 'dg');
  const S = curStudio(), path = `${S.id}/logo.jpg`;
  const up = await sb.storage.from('studio-logos').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '300' }); if (up.error) return fail(up.error);
  const u = await sb.from('studios').update({ logo_path: path }).eq('id', S.id); if (u.error) return fail(u.error);
  S.logo_path = path; toast('Logo actualizado.', 'ok'); render();
}
async function newGame() {
  const t = (prompt('Nombre del juego') || '').trim(); if (t.length < 2) return;
  const S = curStudio(), id = slug(t) + '-' + Math.random().toString(36).slice(2, 6);
  const { error } = await sb.from('products').insert({ id, studio_id: S.id, title: t.slice(0, 120), price_pz: 0 }); if (error) return fail(error);
  MY.stale = true; go('miestudio/' + encodeURIComponent(id));
}
async function saveProduct(pid) {
  const n = id => parseInt(val(id), 10), price = n('ge-price'), disc = n('ge-disc') || 0;
  if (isNaN(price) || price < 0 || price > 100000 || disc < 0 || disc > 90) return toast('Revisa el precio y el descuento.', 'dg');
  const urls = ['ge-itch', 'ge-store', 'ge-embed'].map(i => val(i).trim());
  if (urls.some(u => u && !/^https:\/\//.test(u))) return toast('Las direcciones deben empezar por https://', 'dg');
  const exe = val('ge-exe').trim(); if (exe && !/^[A-Za-z0-9_.-]{2,40}$/.test(exe)) return toast('Nombre de proceso no válido.', 'dg');
  const row = { title: val('ge-title').trim(), description: val('ge-desc').trim() || null, genre: val('ge-genre').trim() || 'Otros', platform: val('ge-plat').trim() || null,
    price_pz: price, discount_pct: disc, pegi: parseInt(val('ge-pegi'), 10) || null, adult: $('#ge-adult').checked,
    itch_url: urls[0] || null, store_url: urls[1] || null, embed_url: urls[2] || null, exe_match: exe || null };
  const { error } = await sb.from('products').update(row).eq('id', pid); if (error) return fail(error);
  toast('Juego guardado.' + (urls[2] ? ' Comprueba el juego en navegador para activarlo.' : ''), 'ok'); MY.stale = true; render();
}
async function checkEmbed(pid) {
  toast('Comprobando el juego…');
  try { const d = await fnCall('check-embed', { product_id: pid }); toast(d.ok ? 'El juego carga y permite incrustarse.' : 'No válido: ' + d.error, d.ok ? 'ok' : 'dg'); MY.stale = true; render(); }
  catch (e) { fail(e); }
}
async function addKeys(pid) {
  const ta = $('#kx'), keys = ta.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!keys.length) return toast('Pega al menos una clave.', 'wn');
  if (keys.length > 500) return toast(ERR.BATCH_SIZE, 'dg');
  try { const d = await fnCall('studio-keys', { product_id: pid, keys }); ta.value = '';
    toast(`Añadidas ${d.added} · repetidas ${d.duplicates} · no válidas ${d.invalid}`, d.added ? 'ok' : 'wn'); MY.stale = true; render(); }
  catch (e) { fail(e); }
}

/* ------------------------------------------------------------ Arcade Shield v2 (el servidor cuenta; el cliente solo informa) */
const AS = { pid: null, sid: null, src: null, base: 0, srv: 0, pend: 0, sinceConfirm: 0, prompt: false, loadedOk: false, starting: false, flushing: false, broken: false, err: false, t: 0 };
const BEAT = 15000, PRESENCE = 240000;
const deskOn = pid => { const p = prod(pid); return !!(window.pjDesktop && p && p.exe); };
async function asStart(pid, src) {
  AS.starting = true;
  try {
    const { data, error } = await sb.rpc('start_play_session', { p_product: pid, p_source: src }); if (error) throw error;
    const q = await sb.from('play_sessions').select('ms_total').eq('product_id', pid).eq('broken', false);
    Object.assign(AS, { pid, sid: data, src, srv: 0, pend: 0, sinceConfirm: 0, prompt: false, broken: false,
      base: (q.data || []).reduce((a, r) => a + Number(r.ms_total), 0) });
  } catch (e) { AS.err = true; AS.sid = null; if (location.hash.startsWith('#jugar/')) fail(e); }
  AS.starting = false;
}
async function flush() {
  if (!AS.sid || !AS.pend || AS.flushing) return;
  const d = Math.round(AS.pend); AS.pend = 0; AS.flushing = true;
  const { data, error } = await sb.rpc('record_heartbeat', { p_session: AS.sid, p_delta_ms: d }); AS.flushing = false;
  if (error) { const k = errCode(error); if (k === 'SESSION_BROKEN') AS.broken = true; if (k === 'PLAN_REQUIRED') fail(error); AS.sid = null; return; }
  AS.srv = Number(data);
  if (state.profile) state.profile.playedMs = (state.profile.playedMs || 0) + d;
}
function ctx() {
  const DSx = typeof DS !== 'undefined' ? DS : null;
  if (DSx && DSx.active && DSx.gameId && prod(DSx.gameId)) return { pid: DSx.gameId, src: 'desktop', ok: true };   // juego de Windows en primer plano, con actividad
  const m = location.hash.match(/^#jugar\/(.+)/); if (!m) return null;
  const pid = m[1], p = prod(pid); if (!p) return null;
  if (deskOn(pid)) return { pid, src: 'desktop', ok: false };
  if (!p.play) return null;
  return { pid, src: 'web', ok: AS.loadedOk && document.visibilityState === 'visible' && document.hasFocus() && !AS.prompt && !AS.broken };
}
function tickAll() {
  if (!REAL || !state.profile || !state.profile.member) return;
  const now = Date.now(), dt = Math.min(1500, now - (AS.t || now)); AS.t = now;
  const c = ctx();
  if (!c) { if (AS.sid && AS.pend) flush(); return; }
  if (AS.pid !== c.pid || AS.src !== c.src) { if (AS.sid) flush(); AS.sid = null; AS.pid = c.pid; AS.src = c.src; AS.err = false; AS.broken = false; }
  if (!AS.sid) { if (!AS.err && !AS.starting && (c.ok || c.src === 'web')) asStart(c.pid, c.src); }
  else if (c.ok) {
    AS.pend += dt; AS.sinceConfirm += dt;
    if (c.src === 'web' && AS.sinceConfirm >= PRESENCE && !AS.prompt) { AS.prompt = true; showPrompt(); }
    if (AS.pend >= BEAT) flush();
  }
  if (location.hash === '#jugar/' + AS.pid) {
    ARC.pid = AS.pid; ARC.ms = AS.base + AS.srv + AS.pend; ARC.active = !!c.ok; ARC.locked = false; ARC.loaded = AS.loadedOk;
    ARC.flag = ''; ARC.wait = !AS.loadedOk ? 'load' : (document.visibilityState !== 'visible' || !document.hasFocus()) ? 'tab' : '';
    updArc();
    const msg = document.getElementById('arc-msg'), pill = document.getElementById('arc-pill');
    if (AS.broken && msg) { msg.textContent = 'Has avisado de que el juego no funciona. No se cuenta tiempo.'; if (pill) pill.textContent = 'Juego con error'; }
    else if (AS.prompt && pill) pill.textContent = 'Confirma que sigues';
    else if (msg) msg.textContent = 'Las Pz se calculan en el servidor con tu tiempo validado. Si el juego no carga, avísalo y no se cuenta.';
  }
}
setInterval(() => { try { tickAll(); } catch (_) {} }, 1000);
function showPrompt() {
  const fr = document.getElementById('frame'); if (!fr || document.getElementById('asp')) return;
  const d = document.createElement('div'); d.className = 'asp'; d.id = 'asp';
  d.innerHTML = `<div><b style="font-size:20px">¿Sigues jugando?</b><p class="small">Confirma para que tu tiempo siga contando.</p><button class="btn g" onclick="PJ.still()">Sí, sigo aquí</button></div>`;
  fr.appendChild(d);
}
async function still() {
  if (AS.sid) { const { error } = await sb.rpc('confirm_presence', { p_session: AS.sid }); if (error) return fail(error); }
  AS.sinceConfirm = 0; AS.prompt = false; const d = document.getElementById('asp'); if (d) d.remove();
}
async function broken() {
  if (!AS.sid) return toast('No hay una sesión de juego activa.', 'wn');
  const { error } = await sb.rpc('report_embed_broken', { p_session: AS.sid, p_reason: 'reportado por el jugador' });
  if (error) return fail(error);
  AS.broken = true; AS.sid = null; AS.err = true; toast('Gracias. Este juego no cuenta tiempo mientras lo revisamos.', 'ok');
}
function postPlay() {
  if (!REAL) return;
  const pb = document.querySelector('.play-bar');
  if (pb && !document.getElementById('asb')) pb.insertAdjacentHTML('beforeend', `<button class="btn ghost sm" id="asb" onclick="PJ.broken()">El juego no carga o da error</button>`);
  const f = document.getElementById('arcf');
  if (f && !f.dataset.v28) {
    f.dataset.v28 = '1'; AS.loadedOk = false;
    f.addEventListener('load', () => { AS.loadedOk = true; });       // load también salta en páginas de error: por eso la validación real es la del servidor (embed_ok)
    setTimeout(() => { if (!AS.loadedOk && document.getElementById('arcf') === f && AS.sid) broken(); }, 25000);   // si no carga en 25 s, no cuenta
    if (AS.prompt) showPrompt();
  }
}
arcClaim = async function () {
  if (!REAL) return;
  const pid = ARC.pid;
  try {
    await flush();
    const body = ARC.rated ? val('arc-txt').trim() : null, stars = ARC.rated ? ARC.stars : null;
    const { data, error } = await sb.rpc('claim_play_reward', { p_product: pid, p_stars: stars, p_body: body }); if (error) throw error;
    state.bankOps[`arc:${state.profile.id}:${pid}`] = { op: 'credit', amount: 0, concept: 'Arcade Shield', ref: 'SRV', at: Date.now() };
    await payoutNow(true);
  } catch (e) { fail(e); }
};

/* ------------------------------------------------------------ app de escritorio: qué juegos vigilar */
function sendGamesToDesktop() {
  if (!window.pjDesktop || !pjDesktop.setGames) return;
  pjDesktop.setGames(state.products.filter(p => p.exe).map(p => ({ id: p.id, match: p.exe })));
}

/* ------------------------------------------------------------ arranque */
Object.assign(window.PJ, { openJoven, login: pidLogin, confirmAge, reveal: revealKey, copy: copyRev, banner, saveProfile, avatar: pickAvatar,
  saveStudio, logo: pickLogo, newGame, saveProduct, checkEmbed, addKeys, still, broken,
  pickStudio: id => { MY.cur = id; MY.stale = true; render(); } });
(async function boot() {
  if (!REAL) { render(); return; }
  try { localStorage.removeItem(KEY); } catch (_) {}      // modo real: nada de datos personales en localStorage
  save = function () {};
  PJX.loading = true; resetLocal(); render();
  try {
    await pidCallback();
    const { data: { session } } = await sb.auth.getSession();
    if (session) await hydrate();
  } catch (e) { console.warn(e); resetLocal(); }
  PJX.loading = false;
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && state.profile) { resetLocal(); render(); } });
  window.addEventListener('hashchange', render);   // el listener original apunta al render sin envolver; este corre después y prevalece
  render();
})();
})();
