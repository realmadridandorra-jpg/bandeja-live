// GET /api/debug?id=FIP-2026-XXXX → qué devuelve el marcador oficial y qué entiende el lector.
import { fetchWidget, parse, DEFAULT_ID } from '../lib/fip.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const id = q.get('id') || process.env.FIP_TOURNAMENT_ID || DEFAULT_ID;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const w = await fetchWidget(id, q.get('day') || '');
    const parsed = parse(w.body);
    res.status(200).end(JSON.stringify({ url: w.url, status: w.status, length: w.body.length, day: parsed.day, count: parsed.matches.length, matches: parsed.matches, sample: w.body.slice(0, 8000) }, null, 2));
  } catch (e) {
    res.status(200).end(JSON.stringify({ id, error: String(e) }));
  }
}
