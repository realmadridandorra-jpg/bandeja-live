// /api/porra → porra privada entre amigos: cada uno elige quién gana antes de que empiece el partido.
//  GET  ?code=XXXXX                          → miembros, elecciones, partidos y resultados
//  POST {action:'create', name}              → crea la porra { code, uid }
//  POST {action:'join', code, name}          → se une { uid }
//  POST {action:'pick', code, uid, mid, pick, meta} → guarda la elección (0 = pareja de arriba, 1 = de abajo)
import crypto from 'node:crypto';
import { kv } from '../lib/kv.js';

const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = n => Array.from(crypto.randomBytes(n), b => ABC[b % ABC.length]).join('');
const K = code => ({ m: `por3:pg:${code}:m`, p: `por3:pg:${code}:p`, x: `por3:pg:${code}:x` });
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanName = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 20);
const obj = arr => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const c of req) s += c;
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
const out = (res, code, data) => res.status(code).end(JSON.stringify(data));

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const code = cleanCode(new URL(req.url, 'http://x').searchParams.get('code'));
      const k = K(code);
      const members = obj(await kv('HGETALL', k.m));
      if (!Object.keys(members).length) return out(res, 404, { error: 'No existe esa porra' });
      const rawP = obj(await kv('HGETALL', k.p));
      const meta = Object.fromEntries(Object.entries(obj(await kv('HGETALL', k.x))).map(([a, b]) => { try { return [a, JSON.parse(b)]; } catch { return [a, {}]; } }));
      const picks = {};
      for (const [key, v] of Object.entries(rawP)) { const [mid, uid] = key.split('|'); (picks[mid] = picks[mid] || {})[uid] = Number(v); }
      const mids = Object.keys(picks);
      const rv = mids.length ? await kv('HMGET', 'por3:res', ...mids) : [];
      const results = {}; mids.forEach((m, i) => { if (rv[i] != null) results[m] = Number(rv[i]); });
      const title = await kv('GET', `por3:pg:${code}:t`);
      return out(res, 200, { code, title, members, picks, meta, results });
    }
    const b = await body(req);
    if (b.action === 'create') {
      const name = cleanName(b.name); if (!name) return out(res, 400, { error: 'Pon tu nombre' });
      let code = '';
      for (let i = 0; i < 5; i++) { const c = rnd(5); if (!(await kv('EXISTS', K(c).m))) { code = c; break; } }
      if (!code) return out(res, 500, { error: 'Inténtalo otra vez' });
      const uid = rnd(10);
      await kv('HSET', K(code).m, uid, name);
      await kv('SET', `por3:pg:${code}:t`, cleanName(b.title) || 'Nuestra porra');
      return out(res, 200, { code, uid });
    }
    if (b.action === 'join') {
      const code = cleanCode(b.code), name = cleanName(b.name);
      if (!name) return out(res, 400, { error: 'Pon tu nombre' });
      const n = await kv('HLEN', K(code).m);
      if (!n) return out(res, 404, { error: 'No existe esa porra. Revisa el código.' });
      if (n >= 12) return out(res, 400, { error: 'La porra está llena' });
      const uid = rnd(10);
      await kv('HSET', K(code).m, uid, name);
      return out(res, 200, { code, uid });
    }
    if (b.action === 'pick') {
      const code = cleanCode(b.code), uid = String(b.uid || '').slice(0, 12), mid = String(b.mid || '').slice(0, 40);
      const pick = Number(b.pick);
      if (!mid || ![0, 1].includes(pick)) return out(res, 400, { error: 'Elección no válida' });
      if (!(await kv('HEXISTS', K(code).m, uid))) return out(res, 403, { error: 'No estás en esta porra' });
      if ((await kv('HGET', 'por3:res', mid)) != null) return out(res, 409, { error: 'Ese partido ya ha terminado' });
      const st = await kv('GET', 'por3:mstate');
      if (st) { try { const s = JSON.parse(st)[mid]; if (s && s.s !== 'upcoming') return out(res, 409, { error: 'Ese partido ya ha empezado' }); } catch { } }
      await kv('HSET', K(code).p, `${mid}|${uid}`, String(pick));
      const m = b.meta || {};
      const meta = { a: String(m.a || '').slice(0, 60), b: String(m.b || '').slice(0, 60), r: String(m.r || '').slice(0, 60), w: String(m.w || '').slice(0, 30), d: Date.now() };
      await kv('HSETNX', K(code).x, mid, JSON.stringify(meta));
      return out(res, 200, { ok: true });
    }
    out(res, 400, { error: 'acción desconocida' });
  } catch (e) {
    out(res, 500, { error: String(e.message || e) });
  }
}
