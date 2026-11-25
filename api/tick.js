// /api/tick → lo llama un reloj de GitHub cada 5 minutos.
// Mira el marcador oficial, compara con la vez anterior y avisa a quien sigue a esos jugadores:
// cuando empieza el partido, cuando acaba cada set y cuando termina.
import { fetchDay, parseDay } from '../lib/fip.js';
import { currentTournament, today } from '../lib/calendar.js';
import { kv } from '../lib/kv.js';
import { send, norm, surname } from '../lib/push.js';

const pair = t => t.players.map(surname).join('/');
// Formato "marcador" para la pantalla de bloqueo: números en negrita, separadores y quién saca.
const BD = s => String(s).replace(/[0-9]/g, d => String.fromCodePoint(0x1D7EC + Number(d)));
const up = t => t.players.map(p => surname(p).toUpperCase()).join(' / ');
function scoreboard(m) {
  const [A, B] = m.teams;
  const row = T => `${T.serving && m.status === 'live' ? '◉' : '○'} ${up(T)}   ${T.sets.map(BD).join(' ┃ ') || BD(0)}`;
  return row(A) + '\n' + row(B);
}
const won = (a, b) => (a ?? 0) > (b ?? 0);

function events(m, before) {
  const [A, B] = m.teams;
  const vs = `${pair(A)} vs ${pair(B)}`;
  const n = Math.max(A.sets.length, B.sets.length);
  const out = [];
  if (before.s === 'upcoming' && m.status === 'live') out.push({ title: `⚡ EN JUEGO · ${String(m.court || '').toUpperCase()}`, body: scoreboard(m) });
  if (m.status === 'live' && n > before.n && before.n >= 1) {
    const k = before.n - 1;
    const w = won(A.sets[k], B.sets[k]) ? A : B;
    out.push({ title: `▰▰ SET ${k + 1} PARA ${up(w)}`, body: scoreboard(m) });
  }
  if (before.s !== 'finished' && m.status === 'finished') {
    const w = m.teams.find(t => t.winner) || (A.sets.filter((s, i) => s > B.sets[i]).length > B.sets.filter((s, i) => s > A.sets[i]).length ? A : B);
    out.push({ title: `🏁 FINAL · GANAN ${up(w)}`, body: scoreboard(m) });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const t = currentTournament();
    const d = today();
    if (!(t.start <= d && d <= t.end)) return res.status(200).end(JSON.stringify({ idle: 'no hay torneo hoy' }));
    const p = parseDay((await fetchDay(t.id, '')).body);
    const prevRaw = await kv('GET', 'por3:mstate');
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    const next = {};
    const evs = [];
    for (const m of p.matches) {
      const n = Math.max(m.teams[0].sets.length, m.teams[1].sets.length);
      next[m.id] = { s: m.status, n };
      const before = prev && prev[m.id];
      if (!before) continue; // la primera vez solo se apunta, para no mandar avisos viejos
      for (const e of events(m, before)) evs.push({ ...e, who: m.teams.flatMap(x => x.players.map(pl => norm(surname(pl)))), tag: `por3-${m.id}` });
    }
    await kv('SET', 'por3:mstate', JSON.stringify(next), 'EX', 259200);
    // Resultados para la porra: quién ganó cada partido terminado (0 = pareja de arriba, 1 = de abajo).
    const fin = p.matches.flatMap(m => { const w = m.teams.findIndex(x => x.winner); return m.status === 'finished' && w >= 0 ? [m.id, String(w)] : []; });
    if (fin.length) await kv('HSET', 'por3:res', ...fin);
    let sent = 0, gone = 0;
    if (evs.length) {
      const all = await kv('HGETALL', 'por3:subs') || [];
      for (let i = 0; i < all.length; i += 2) {
        const id = all[i]; let rec; try { rec = JSON.parse(all[i + 1]); } catch { continue; }
        const favs = new Set(rec.favs || []);
        for (const e of evs) {
          if (!e.who.some(w => favs.has(w))) continue;
          const r = await send(rec.sub, { title: e.title, body: e.body, tag: e.tag });
          if (r === 'ok') sent++;
          if (r === 'gone') { gone++; await kv('HDEL', 'por3:subs', id); break; }
        }
      }
    }
    res.status(200).end(JSON.stringify({ tournament: t.slug, matches: p.matches.length, first: !prev, events: evs.length, sent, gone }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: String(e.message || e) }));
  }
}
