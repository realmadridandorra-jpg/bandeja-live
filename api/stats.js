// GET /api/stats?match=MD061&tid=4801&year=2026 → estadísticas del partido (puntos ganados, breaks, saque…)
import { fetchStats } from '../lib/fip.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const matchId = (q.get('match') || '').toUpperCase(), tid = q.get('tid') || '', year = q.get('year') || '2026';
  if (!/^[A-Z]{2}\d{2,4}$/.test(matchId) || !/^\d{2,6}$/.test(tid) || !/^\d{4}$/.test(year)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).end(JSON.stringify({ error: 'Faltan datos del partido.' }));
  }
  try {
    const s = await fetchStats({ matchId, year, tid });
    res.setHeader('Cache-Control', q.get('live') ? 's-maxage=20' : 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).end(JSON.stringify(s));
  } catch {
    res.setHeader('Cache-Control', 's-maxage=15');
    return res.status(200).end(JSON.stringify({ status: 0, error: 'No se pudieron cargar las estadísticas.' }));
  }
}
