// GET /api/draw?id=FIP-2026-XXXX → cuadro principal del torneo por rondas (masculino y femenino),
// reconstruido con los partidos de todos los días del marcador oficial.
import { fetchDay, parseDay } from '../lib/fip.js';
import { currentTournament, byId, today } from '../lib/calendar.js';

const ORDER = ['round of 64', 'round of 32', 'round of 16', 'quarter', 'semi', 'final'];
const rank = r => { const s = r.toLowerCase(); const i = ORDER.findIndex(k => s.includes(k)); return i < 0 ? -1 : i; };

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const t = byId(q.get('id') || '') || currentTournament();
  try {
    const first = parseDay((await fetchDay(t.id, 1)).body);
    const n = first.days.length || t.days || 8;
    const rest = await Promise.all(Array.from({ length: n - 1 }, (_, i) => fetchDay(t.id, i + 2).then(w => parseDay(w.body)).catch(() => ({ matches: [] }))));
    const all = [first, ...rest].flatMap(p => p.matches);
    const seen = new Map();
    for (const m of all) {
      if (!['MD', 'WD'].includes(m.event)) continue;
      const prev = seen.get(m.id);
      if (!prev || prev.status !== 'finished') seen.set(m.id, m);
    }
    const out = {};
    for (const ev of ['MD', 'WD']) {
      const rounds = new Map();
      for (const m of seen.values()) {
        if (m.event !== ev) continue;
        const name = (m.round.split(' · ')[1] || m.round).trim();
        if (!rounds.has(name)) rounds.set(name, []);
        rounds.get(name).push(m);
      }
      out[ev] = [...rounds.entries()].sort((a, b) => rank(b[0]) - rank(a[0])).map(([name, matches]) => ({ name, matches: matches.sort((x, y) => x.id.localeCompare(y.id)) }));
    }
    const live = [...seen.values()].some(m => m.status === 'live');
    const done = t.end < today();
    res.setHeader('Cache-Control', done ? 's-maxage=86400, stale-while-revalidate=604800' : live ? 's-maxage=60, stale-while-revalidate=120' : 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).end(JSON.stringify({ tournament: { id: t.id, name: t.name, city: t.city, cat: t.cat }, draw: out, updated: new Date().toISOString() }));
  } catch {
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(200).end(JSON.stringify({ tournament: { id: t.id, name: t.name }, error: 'No se pudo cargar el cuadro.', draw: { MD: [], WD: [] } }));
  }
}
