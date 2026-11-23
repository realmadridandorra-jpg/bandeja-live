// GET /api/live?id=FIP-2026-XXXX   → partidos del torneo, normalizados
// GET /api/live?demo=1             → partidos simulados que avanzan solos
// La respuesta se cachea 10 s en el CDN de Vercel: aunque haya cientos de personas mirando,
// al widget oficial solo le llega una petición cada 10 s.
import { fetchWidget, parse, discoverTournamentId } from '../lib/fip.js';
import { demoMatches } from '../lib/demo.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (q.get('demo')) {
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');
    return res.status(200).end(JSON.stringify({ source: 'demo', tournament: { id: 'DEMO', name: 'Modo demostración' }, updated: new Date().toISOString(), matches: demoMatches() }));
  }

  const raw = (q.get('id') || '').trim();
  const id = /^[A-Z]{2,5}-\d{4}-\d{2,6}$/i.test(raw) ? raw.toUpperCase() : await discoverTournamentId();
  if (!id) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).end(JSON.stringify({ source: 'fip', error: 'no_tournament', message: 'No sé qué torneo seguir. Pon su ID (p. ej. FIP-2026-1234) en Ajustes o en la variable FIP_TOURNAMENT_ID.', matches: [] }));
  }

  try {
    const w = await fetchWidget(id);
    if (w.status !== 200) {
      res.setHeader('Cache-Control', 's-maxage=30');
      return res.status(200).end(JSON.stringify({ source: 'fip', tournament: { id }, error: 'upstream_' + w.status, message: `El marcador oficial respondió ${w.status}.`, matches: [] }));
    }
    const { matches, note } = parse(w.body, w.type);
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    return res.status(200).end(JSON.stringify({
      source: 'fip', tournament: { id }, updated: new Date().toISOString(), matches,
      ...(note ? { message: note } : {}),
      ...(!matches.length && !note && w.body.length > 500 ? { warning: 'parser_no_match', message: 'He recibido datos pero no reconozco su formato. Revisa /api/debug?id=' + id } : {})
    }));
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=15');
    return res.status(200).end(JSON.stringify({ source: 'fip', tournament: { id }, error: 'fetch_failed', message: 'No se pudo contactar con el marcador oficial.', matches: [] }));
  }
}
