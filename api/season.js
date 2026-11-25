// /api/season → va guardando la temporada poco a poco (lo llama el reloj de GitHub).
import { seasonStep } from '../lib/season.js';
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try { res.status(200).end(JSON.stringify(await seasonStep())); }
  catch (e) { res.status(500).end(JSON.stringify({ error: String(e.message || e) })); }
}
