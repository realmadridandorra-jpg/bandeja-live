// /api/push
//  GET  ?vapid=1                        → clave pública para suscribirse
//  POST {action:'sub', sub, favs}       → guarda (o actualiza) la suscripción y los favoritos
//  POST {action:'unsub', endpoint}      → la borra
//  POST {action:'test', endpoint}       → manda un aviso de prueba a ese móvil
import { kv } from '../lib/kv.js';
import { vapid, send, subId } from '../lib/push.js';

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = ''; for await (const c of req) s += c;
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const v = await vapid();
      return res.status(200).end(JSON.stringify({ publicKey: v.publicKey }));
    }
    const b = await body(req);
    if (b.action === 'sub') {
      const sub = b.sub;
      if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return res.status(400).end('{"error":"suscripción no válida"}');
      const favs = (Array.isArray(b.favs) ? b.favs : []).map(String).slice(0, 60);
      await kv('HSET', 'por3:subs', subId(sub.endpoint), JSON.stringify({ sub, favs, t: Date.now() }));
      return res.status(200).end(JSON.stringify({ ok: true, favs: favs.length }));
    }
    if (b.action === 'unsub') {
      await kv('HDEL', 'por3:subs', subId(b.endpoint));
      return res.status(200).end('{"ok":true}');
    }
    if (b.action === 'test') {
      const raw = await kv('HGET', 'por3:subs', subId(b.endpoint));
      if (!raw) return res.status(404).end('{"error":"este móvil no está apuntado"}');
      const r = await send(JSON.parse(raw).sub, { title: '🎾 Por3', body: '¡Listo! Te avisaremos de tus favoritos aunque tengas la app cerrada.', tag: 'por3-test' });
      return res.status(200).end(JSON.stringify({ result: r }));
    }
    res.status(400).end('{"error":"acción desconocida"}');
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: String(e.message || e) }));
  }
}
