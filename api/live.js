// GET /api/live                  → partidos de hoy del torneo en juego (por defecto, Mexico Major 2026)
// GET /api/live?id=FIP-2026-XXXX → partidos de hoy de ese torneo
// GET /api/live?demo=1           → partidos simulados que avanzan solos
// La respuesta se guarda 10 s en el CDN de Vercel: al marcador oficial le llega como mucho una petición cada 10 s.
import { fetchWidget, parse, discoverTournamentId } from '../lib/fip.js';
import { demoMatches } from '../lib/demo.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (cache, obj) => { res.setHeader('Cache-Control', cache); res.status(200).end(JSON.stringify(obj)); };

  if (q.get('demo')) {
    return send('s-maxage=5, stale-while-revalidate=5', { source: 'demo', tournament: { id: 'DEMO' }, updated: new Date().toISOString(), matches: demoMatches() });
  }

  const raw = (q.get('id') || '').trim();
  const id = /^[A-Z]{2,5}-\d{4}-\d{2,6}$/i.test(raw) ? raw.toUpperCase() : await discoverTournamentId();
  const day = /^\d{1,2}$/.test(q.get('day') || '') ? q.get('day') : '';

  try {
    const w = await fetchWidget(id, day);
    if (w.status !== 200) {
      return send('s-maxage=30', { source: 'fip', tournament: { id }, error: 'upstream_' + w.status, message: `El marcador oficial respondió ${w.status}.`, matches: [] });
    }
    const { day: dayLabel, matches } = parse(w.body);
    const anyLive = matches.some(m => m.status === 'live');
    return send(anyLive ? 's-maxage=10, stale-while-revalidate=20' : 's-maxage=60, stale-while-revalidate=60', {
      source: 'fip', tournament: { id, day: dayLabel }, updated: new Date().toISOString(), matches,
      ...(!matches.length ? { message: 'Hoy no hay partidos programados en este torneo.' } : {})
    });
  } catch (e) {
    return send('s-maxage=15', { source: 'fip', tournament: { id }, error: 'fetch_failed', message: 'No se pudo contactar con el marcador oficial.', matches: [] });
  }
}
