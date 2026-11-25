// /api/h2h?a=<jugador1|jugador2>&b=<jugador1|jugador2>
// Balance de la temporada de cada pareja, sus títulos, sus últimos partidos y sus enfrentamientos.
import { loadSeason, pairKey } from '../lib/season.js';
import { CALENDAR } from '../lib/calendar.js';

const ORDER = Object.fromEntries(CALENDAR.map((t, i) => [t.slug, i]));
const NAME = Object.fromEntries(CALENDAR.map(t => [t.slug, t.name]));

function line(m, side) {
  const me = side === 0 ? m.sa : m.sb, op = side === 0 ? m.sb : m.sa;
  return { t: NAME[m.t] || m.t, r: m.r, won: m.w === side, score: me.map((s, i) => `${s}-${op[i] ?? ''}`).join(' '), vs: (side === 0 ? m.b : m.a).join(' / ') };
}

function profile(all, key) {
  const ms = all.filter(m => pairKey(m.a) === key || pairKey(m.b) === key)
    .sort((x, y) => (ORDER[y.t] - ORDER[x.t]) || (y.d - x.d));
  let w = 0, l = 0, titles = 0, finals = 0;
  const last = [];
  for (const m of ms) {
    const side = pairKey(m.a) === key ? 0 : 1;
    if (m.w === side) w++; else if (m.w != null) l++;
    if (/^final$/i.test(m.r)) { finals++; if (m.w === side) titles++; }
    if (last.length < 5) last.push(line(m, side));
  }
  return { played: ms.length, w, l, titles, finals, last };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    const A = pairKey(String(q.get('a') || '').split('|').filter(Boolean));
    const B = pairKey(String(q.get('b') || '').split('|').filter(Boolean));
    const all = await loadSeason();
    const meet = all.filter(m => { const k = [pairKey(m.a), pairKey(m.b)]; return k.includes(A) && k.includes(B); })
      .sort((x, y) => (ORDER[y.t] - ORDER[x.t]) || (y.d - x.d))
      .map(m => line(m, pairKey(m.a) === A ? 0 : 1));
    const tournaments = new Set(all.map(m => m.t)).size;
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).end(JSON.stringify({ tournaments, a: profile(all, A), b: profile(all, B), meetings: meet, aw: meet.filter(x => x.won).length, bw: meet.filter(x => !x.won).length }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: String(e.message || e) }));
  }
}
