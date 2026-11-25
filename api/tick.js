// /api/tick → lo llama un reloj de GitHub cada 5 minutos.
// Mira el marcador oficial, compara con la vez anterior y avisa a quien sigue a esos jugadores:
// cuando empieza el partido, cuando acaba cada set y cuando termina.
import { fetchDay, parseDay } from '../lib/fip.js';
import { currentTournament, today } from '../lib/calendar.js';
import { kv } from '../lib/kv.js';
import { send, norm, surname } from '../lib/push.js';

// Aspecto de los avisos: solo 3 momentos (empieza, set, final), con banderas y el marcador limpio.
const ISO = { ESP: 'ES', ARG: 'AR', ITA: 'IT', FRA: 'FR', POR: 'PT', BRA: 'BR', MEX: 'MX', NED: 'NL', GBR: 'GB', BEL: 'BE', SWE: 'SE', CHI: 'CL', URU: 'UY', PAR: 'PY', GER: 'DE', UAE: 'AE', QAT: 'QA', USA: 'US', DEN: 'DK', FIN: 'FI', EGY: 'EG', KUW: 'KW', SUI: 'CH', AUT: 'AT', RSA: 'ZA', JPN: 'JP', POL: 'PL', CZE: 'CZ', AUS: 'AU', IRL: 'IE', NOR: 'NO', ECU: 'EC', VEN: 'VE', COL: 'CO', PER: 'PE', LTU: 'LT', EST: 'EE', UKR: 'UA', CAN: 'CA', KSA: 'SA', BUL: 'BG', ROU: 'RO', HUN: 'HU', CRO: 'HR', SLO: 'SI', LAT: 'LV', MAR: 'MA', TUN: 'TN', IND: 'IN', CHN: 'CN', KOR: 'KR' };
const flagEmoji = c => { const i = ISO[c]; return i ? String.fromCodePoint(...[...i].map(x => 127397 + x.charCodeAt(0))) : ''; };
const cap = s => String(s).toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase());
const pair = t => t.players.map(p => cap(surname(p))).join(' / ');
const flags = t => (t.flags && t.flags.length === t.players.length ? t.flags.map(flagEmoji).join('') : '') || '🎾';
const RONDA = [[/final/i, 'Final'], [/semi/i, 'Semifinal'], [/quarter/i, 'Cuartos'], [/round of 16/i, 'Octavos'], [/round of 32/i, 'Dieciseisavos'], [/round of 64/i, 'Treintaidosavos']];
const ronda = m => { const r = (m.round.split(' · ')[1] || m.round).trim(); const f = RONDA.find(([re]) => re.test(r)); const rr = /semi/i.test(r) ? 'Semifinal' : /quarter/i.test(r) ? 'Cuartos' : f ? f[1] : r; return (m.event === 'WD' ? 'Fem. · ' : m.event === 'MD' ? 'Masc. · ' : '') + rr; };
const won = (a, b) => (a ?? 0) > (b ?? 0);

function card(m, tname, upto, winnerIdx) {
  const [A, B] = m.teams;
  const row = (T, O, i) => `${flags(T)} ${pair(T)}${upto ? '  ' + T.sets.slice(0, upto).join('  ') : ''}${winnerIdx === i ? '  ✓' : ''}`;
  const where = [tname, ronda(m), m.court ? cap(m.court) : ''].filter(Boolean).join(' · ');
  return `${row(A, B, 0)}\n${row(B, A, 1)}\n${where}`;
}

function events(m, before, tname) {
  const [A, B] = m.teams;
  const n = Math.max(A.sets.length, B.sets.length);
  const out = [];
  if (before.s === 'upcoming' && m.status === 'live') out.push({ title: '▶️ Empieza el partido', body: card(m, tname, 0, -1) });
  if (m.status === 'live' && n > before.n && before.n >= 1) {
    const k = before.n - 1;
    const wi = won(A.sets[k], B.sets[k]) ? 0 : 1;
    out.push({ title: `🟢 Set ${k + 1} para ${pair(m.teams[wi])}`, body: card(m, tname, k + 1, -1) });
  }
  if (before.s !== 'finished' && m.status === 'finished') {
    let wi = m.teams.findIndex(t => t.winner);
    if (wi < 0) wi = A.sets.filter((s, i) => s > B.sets[i]).length >= B.sets.filter((s, i) => s > A.sets[i]).length ? 0 : 1;
    out.push({ title: `🏆 Ganan ${pair(m.teams[wi])}`, body: card(m, tname, Math.max(A.sets.length, B.sets.length), wi) });
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
      for (const e of events(m, before, t.name)) evs.push({ ...e, who: m.teams.flatMap(x => x.players.map(pl => norm(surname(pl)))), tag: `por3-${m.id}` });
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
