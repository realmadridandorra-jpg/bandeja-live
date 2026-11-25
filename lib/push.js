// Avisos al móvil aunque la app esté cerrada (Web Push).
// Las claves VAPID se crean solas la primera vez y se guardan en la base de datos.
import webpush from 'web-push';
import crypto from 'node:crypto';
import { kv } from './kv.js';

const SUBJECT = 'https://bandeja-live-puce.vercel.app';
let cache = null;

export async function vapid() {
  if (cache) return cache;
  let v = await kv('GET', 'por3:vapid');
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    await kv('SET', 'por3:vapid', JSON.stringify(k), 'NX');
    v = await kv('GET', 'por3:vapid');
  }
  cache = JSON.parse(v);
  return cache;
}

export const subId = endpoint => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 20);

// Igual que en la app: apellido = primera palabra que no es una inicial, sin tildes y en minúsculas.
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const surname = n => { const t = String(n).trim().split(/\s+/).filter(x => !/\.$/.test(x)); return t[0] || n; };

export async function send(sub, payload) {
  const v = await vapid();
  webpush.setVapidDetails(SUBJECT, v.publicKey, v.privateKey);
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 900, urgency: 'high' });
    return 'ok';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return 'gone';
    return 'error ' + (e.statusCode || e.message);
  }
}
