// Cliente de la API del banco (placetaone). La clave x-api-key solo existe en el servidor.
import { admin, env, HttpError } from './common.ts';

const BASE = Deno.env.get('PLACETAONE_BASE') ?? 'https://placetaone.vercel.app';
export const IBAN_RE = /^PZ-\d{4}-\d{4}$/;

export async function upstream(method: string, path: string, body?: unknown, idem?: string): Promise<Record<string, any>> {
  const r = await fetch(BASE + path, {
    method, signal: AbortSignal.timeout(10_000),
    headers: { 'x-api-key': env('PLACETAONE_API_KEY'), 'content-type': 'application/json', ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = (await r.text()).slice(0, 200_000);
  let data: Record<string, any> = {}; try { data = JSON.parse(text); } catch (_) { /* no JSON */ }
  if (!r.ok) {
    console.error('bank upstream', method, path.split('?')[0], r.status);      // nunca registrar clave, DIP ni cuerpo
    throw new HttpError(r.status === 404 ? 404 : r.status === 422 ? 422 : r.status === 400 ? 400 : 502,
      r.status === 404 ? 'NOT_FOUND' : r.status === 422 ? 'NOT_ELIGIBLE' : r.status === 400 ? 'BAD_REQUEST' : 'UPSTREAM');
  }
  return data;
}
export const saveIban = async (uid: string, iban: unknown) => {
  if (typeof iban === 'string' && IBAN_RE.test(iban)) await admin().from('profiles').update({ joven_iban: iban }).eq('id', uid);
};

/** Placeta Joven: desde los 16 años cumplidos hasta el 31 de diciembre del año en que se cumplen 31. */
export function eligibleJoven(birth: string | null, today = new Date()): boolean {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return false;
  const [y, m, d] = birth.split('-').map(Number);
  return new Date(y + 16, m - 1, d) <= today && today <= new Date(y + 31, 11, 31, 23, 59, 59);
}
