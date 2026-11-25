// Archivo de la temporada: guarda en la base de datos todos los partidos del cuadro final (MD/WD)
// de cada torneo, para poder sacar el cara a cara entre parejas y su balance.
import { fetchDay, parseDay } from './fip.js';
import { CALENDAR, today, currentTournament } from './calendar.js';
import { kv } from './kv.js';
import { norm, surname } from './push.js';

export const pairKey = players => players.map(p => norm(surname(p))).sort().join('/');

export async function indexTournament(t) {
  const first = parseDay((await fetchDay(t.id, 1)).body);
  const n = first.days.length || t.days || 8;
  const rest = await Promise.all(Array.from({ length: n - 1 }, (_, i) =>
    fetchDay(t.id, i + 2).then(w => parseDay(w.body)).catch(() => ({ matches: [] }))));
  const seen = new Map();
  [first, ...rest].forEach((p, di) => p.matches.forEach(m => {
    if (!['MD', 'WD'].includes(m.event) || m.status !== 'finished') return;
    const w = m.teams.findIndex(x => x.winner);
    seen.set(m.id, {
      id: m.id, t: t.slug, d: di + 1, e: m.event, r: (m.round.split(' · ')[1] || m.round).trim(),
      a: m.teams[0].players, b: m.teams[1].players, fa: m.teams[0].flags, fb: m.teams[1].flags,
      sa: m.teams[0].sets, sb: m.teams[1].sets, w: w < 0 ? null : w
    });
  }));
  const list = [...seen.values()];
  await kv('SET', `por3:season:${t.slug}`, JSON.stringify(list));
  return list.length;
}

// Un paso: el torneo de esta semana (si toca) y un torneo antiguo que aún no esté guardado.
export async function seasonStep() {
  const d = today();
  const done = [];
  const cur = currentTournament();
  if (cur.start <= d) {
    const last = Number(await kv('GET', 'por3:season:curts') || 0);
    if (Date.now() - last > 20 * 60e3) {
      done.push([cur.slug, await indexTournament(cur)]);
      await kv('SET', 'por3:season:curts', String(Date.now()));
    }
  }
  const ended = CALENDAR.filter(t => t.end < d && t.slug !== cur.slug);
  const have = ended.length ? await kv('HMGET', 'por3:season:ok', ...ended.map(t => t.slug)) : [];
  const todo = ended.find((t, i) => !have[i]);
  if (todo) {
    const n = await indexTournament(todo);
    await kv('HSET', 'por3:season:ok', todo.slug, String(n));
    done.push([todo.slug, n]);
  }
  return { done, pending: ended.filter((t, i) => !have[i]).length - (todo ? 1 : 0) };
}

export async function loadSeason() {
  const keys = CALENDAR.map(t => `por3:season:${t.slug}`);
  const vals = await kv('MGET', ...keys);
  return vals.flatMap(v => { try { return v ? JSON.parse(v) : []; } catch { return []; } });
}
