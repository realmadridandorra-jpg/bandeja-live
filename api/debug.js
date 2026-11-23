// GET /api/debug?id=FIP-2026-XXXX&day=3 → qué devuelve el marcador oficial y qué entiende el lector.
import { fetchDay, parseDay } from '../lib/fip.js';
import { currentTournament } from '../lib/calendar.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const id = q.get('id') || currentTournament().id;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const w = await fetchDay(id, q.get('day') || '');
    const p = parseDay(w.body);
    res.status(200).end(JSON.stringify({ url: w.url, status: w.status, length: w.body.length, days: p.days, day: p.day, count: p.matches.length, matches: p.matches, sample: w.body.slice(0, 6000) }, null, 2));
  } catch (e) {
    res.status(200).end(JSON.stringify({ id, error: String(e) }));
  }
}
