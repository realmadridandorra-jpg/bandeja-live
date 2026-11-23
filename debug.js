// GET /api/debug?id=FIP-2026-XXXX → muestra qué devuelve el widget oficial (estado, tipo y primeros 20 000 caracteres)
// y qué entiende el lector. Úsalo para ajustar SELECTORS en lib/fip.js si el formato cambia.
import { fetchWidget, parse, liveUrl, SELECTORS } from '../lib/fip.js';

export default async function handler(req, res) {
  const id = new URL(req.url, 'http://x').searchParams.get('id') || process.env.FIP_TOURNAMENT_ID;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!id) return res.status(400).end(JSON.stringify({ error: 'Falta ?id=FIP-2026-XXXX' }));
  try {
    const w = await fetchWidget(id);
    const parsed = parse(w.body, w.type);
    res.status(200).end(JSON.stringify({ url: liveUrl(id), status: w.status, type: w.type, length: w.body.length, selectors: SELECTORS, parsed, sample: w.body.slice(0, 20000) }, null, 2));
  } catch (e) {
    res.status(200).end(JSON.stringify({ url: liveUrl(id), error: String(e) }));
  }
}
