// GET /api/live                     → partidos de hoy del torneo en juego (lo elige solo por fecha)
// GET /api/live?id=FIP-2026-XXXX    → otro torneo
// GET /api/live?day=3               → otro día del torneo
// GET /api/live?demo=1              → partidos simulados que avanzan solos
// La respuesta se guarda en el CDN de Vercel (10 s con partidos en juego, 60 s si no),
// así que al marcador oficial le llega como mucho una petición cada 10 s aunque mire mucha gente.
import { fetchDay, parseDay } from '../lib/fip.js';
import { currentTournament, byId, today } from '../lib/calendar.js';
import { demoMatches } from '../lib/demo.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (cache, obj) => { res.setHeader('Cache-Control', cache); res.status(200).end(JSON.stringify(obj)); };

  if (q.get('demo')) {
    return send('s-maxage=5, stale-while-revalidate=5', { source: 'demo', tournament: { id: 'DEMO', name: 'Modo demostración' }, days: [], updated: new Date().toISOString(), matches: demoMatches() });
  }

  const raw = (q.get('id') || '').trim();
  const t = (/^[A-Z]{2,5}-\d{4}-\d{2,6}$/i.test(raw) && (byId(raw) || { id: raw.toUpperCase(), name: raw.toUpperCase() })) || currentTournament();
  const d = today();
  const phase = t.start > d ? 'upcoming' : t.end < d ? 'finished' : 'live';
  const day = /^\d{1,2}$/.test(q.get('day') || '') ? q.get('day') : (phase === 'finished' ? String(t.days || '') : '');
  const meta = { id: t.id, name: t.name, cat: t.cat, city: t.city, start: t.start, end: t.end, phase };

  if (phase === 'upcoming' && !q.get('day')) {
    return send('s-maxage=300', { source: 'fip', tournament: meta, days: [], matches: [], message: `El ${t.name} empieza el ${t.start.split('-').reverse().slice(0, 2).join('/')}.` });
  }

  try {
    const w = await fetchDay(t.id, day);
    if (w.status !== 200) {
      return send('s-maxage=30', { source: 'fip', tournament: meta, error: 'upstream_' + w.status, message: `El marcador oficial respondió ${w.status}.`, days: [], matches: [] });
    }
    const p = parseDay(w.body);
    const anyLive = p.matches.some(m => m.status === 'live');
    return send(anyLive ? 's-maxage=10, stale-while-revalidate=20' : 's-maxage=60, stale-while-revalidate=120', {
      source: 'fip', tournament: { ...meta, day: p.day, dayLabel: p.dayLabel }, days: p.days,
      updated: new Date().toISOString(), matches: p.matches,
      ...(!p.matches.length ? { message: 'Este día no hay partidos programados.' } : {})
    });
  } catch (e) {
    return send('s-maxage=15', { source: 'fip', tournament: meta, error: 'fetch_failed', message: 'No se pudo contactar con el marcador oficial.', days: [], matches: [] });
  }
}
