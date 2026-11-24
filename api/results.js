// GET /api/results → calendario de la temporada con los campeones de cada torneo terminado,
// sacados del último día de cada torneo en el marcador oficial. Se guarda 6 h en caché.
import { fetchDay, parseDay } from '../lib/fip.js';
import { CALENDAR, today } from '../lib/calendar.js';

function finalOf(matches, ev) {
  const m = matches.find(x => x.event === ev && /(^|·\s*)final$/i.test(x.round.trim()) && x.status === 'finished');
  if (!m) return null;
  const w = m.teams.findIndex(t => t.winner);
  if (w < 0) return null;
  const W = m.teams[w], L = m.teams[1 - w];
  const score = W.sets.map((s, i) => `${s}-${L.sets[i] ?? ''}${W.tb[i] != null ? `(${W.tb[i]})` : L.tb[i] != null ? `(${L.tb[i]})` : ''}`).join(' ');
  return [W.players.join(' / '), L.players.join(' / '), score, W.flags || []];
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const d = today();
  const ended = CALENDAR.filter(t => t.end < d || (t.end === d));
  const results = await Promise.all(ended.map(async t => {
    try {
      const p = parseDay((await fetchDay(t.id, t.days)).body);
      return [t.slug, { m: finalOf(p.matches, 'MD'), f: finalOf(p.matches, 'WD') }];
    } catch { return [t.slug, null]; }
  }));
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.status(200).end(JSON.stringify({
    updated: new Date().toISOString(),
    calendar: CALENDAR.map(({ slug, name, cat, city, id, start, end }) => ({ slug, name, cat, city, id, start, end })),
    results: Object.fromEntries(results.filter(([, r]) => r && (r.m || r.f)))
  }));
}
