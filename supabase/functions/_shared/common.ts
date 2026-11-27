import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Falta el secreto ${k}`);
  return v;
};

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://joven.laplaceta.org').split(',').map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(o) ? o : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

export const admin = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** Cliente que actúa COMO el usuario (RLS aplicada). */
export const asUser = (req: Request): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });

export async function requireUser(req: Request) {
  const sb = asUser(req);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'AUTH_REQUIRED');
  return { sb, user: data.user };
}

export class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

/* ---------- Cifrado de claves: AES-256-GCM, IV aleatorio, product_id como dato asociado ---------- */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(): Promise<CryptoKey> {
  const raw = unb64(env('KEYS_ENC_SECRET'));            // 32 bytes en base64: openssl rand -base64 32
  if (raw.length !== 32) throw new Error('KEYS_ENC_SECRET debe tener 32 bytes');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptKey(plain: string, productId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(productId) },
    await aesKey(), new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return 'v1:' + b64(out);
}

export async function decryptKey(cipher: string, productId: string): Promise<string> {
  if (!cipher.startsWith('v1:')) throw new Error('Formato de clave desconocido');
  const raw = unb64(cipher.slice(3));
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: new TextEncoder().encode(productId) },
    await aesKey(), raw.slice(12));
  return new TextDecoder().decode(pt);
}

export async function keyHash(plain: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', unb64(env('KEYS_HMAC_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(plain)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}
