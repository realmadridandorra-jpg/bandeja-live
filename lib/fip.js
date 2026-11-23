// Fuente de datos: widget oficial de marcador en directo (Matchscorer de Crionet) que padelfip.com inserta en su web.
// El widget exige la cabecera Referer de padelfip.com; sin ella responde 403.
import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TEMPLATE = process.env.LIVE_URL_TEMPLATE || 'https://widget.matchscorerlive.com/screen/tournamentlive/{id}';

export function liveUrl(id) {
  return TEMPLATE.replace('{id}', encodeURIComponent(id));
}

export async function fetchWidget(id) {
  const url = liveUrl(id);
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.padelfip.com/',
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(7000)
  });
  const body = await res.text();
  return { url, status: res.status, type: res.headers.get('content-type') || '', body };
}

// Intenta averiguar el ID del torneo en juego leyendo la portada de padelfip.
// padelfip tiene protección anti-bots, así que puede fallar: por eso el ID también se puede fijar a mano.
export async function discoverTournamentId() {
  if (process.env.FIP_TOURNAMENT_ID) return process.env.FIP_TOURNAMENT_ID.trim();
  try {
    const res = await fetch('https://www.padelfip.com/es/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const ids = [...new Set(html.match(/FIP-20\d\d-\d{3,5}/g) || [])];
    return ids[0] || null;
  } catch { return null; }
}

const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const nums = arr => arr.map(clean).filter(x => /^\d{1,2}$/.test(x)).map(Number);
const POINT = /^(0|15|30|40|A|AD|Ad|\d{1,2})$/;

// Normaliza la respuesta del widget a { matches: [...] }.
// El widget puede devolver JSON o HTML; para el HTML se usan selectores por aproximación
// (clases que contienen match/team/player/set/point/serv). Si la estructura real es otra,
// ajusta SELECTORS tras mirar la salida de /api/debug o de `npm run probe`.
export const SELECTORS = {
  match: '[class*="match" i]:not([class*="matches" i])',
  team: '[class*="team" i], [class*="pair" i]',
  player: '[class*="player" i], [class*="name" i]',
  set: '[class*="set" i], [class*="score" i]',
  point: '[class*="point" i], [class*="game-score" i], [class*="current" i]',
  serve: '[class*="serv" i], [class*="ball" i]',
  court: '[class*="court" i]',
  round: '[class*="round" i], [class*="phase" i]'
};

export function parse(body, type) {
  if (type.includes('json') || /^\s*[[{]/.test(body)) {
    try { return parseJson(JSON.parse(body)); } catch { /* sigue como HTML */ }
  }
  return parseHtml(body);
}

function parseJson(data) {
  const list = Array.isArray(data) ? data : data.matches || data.Matches || data.data || [];
  const matches = list.map((m, i) => {
    const t = m.teams || m.Teams || [m.team1 || m.Team1, m.team2 || m.Team2].filter(Boolean);
    return {
      id: String(m.id ?? m.Id ?? m.matchId ?? i),
      court: clean(m.court ?? m.Court ?? ''),
      round: clean(m.round ?? m.Round ?? ''),
      status: status(JSON.stringify(m)),
      teams: t.map(x => ({
        players: [].concat(x.players ?? x.Players ?? x.name ?? x.Name ?? []).map(p => clean(p.name ?? p.Name ?? p)),
        sets: [].concat(x.sets ?? x.Sets ?? []).map(Number).filter(n => !Number.isNaN(n)),
        point: clean(String(x.points ?? x.Points ?? x.point ?? '')),
        serving: Boolean(x.serving ?? x.Serving ?? x.serve),
        winner: Boolean(x.winner ?? x.Winner)
      }))
    };
  }).filter(m => m.teams.length === 2);
  return { matches };
}

function parseHtml(html) {
  const $ = load(html);
  if (/no live matches/i.test($('body').text())) return { matches: [], note: 'El widget dice que no hay partidos en juego ahora mismo.' };
  const out = [];
  $(SELECTORS.match).each((i, el) => {
    const m = $(el);
    // Evita contenedores que engloban varios partidos
    if (m.find(SELECTORS.match).length) return;
    const teams = m.find(SELECTORS.team).filter((_, t) => !$(t).find(SELECTORS.team).length).slice(0, 2);
    if (teams.length !== 2) return;
    const parsed = teams.toArray().map(t => {
      const T = $(t);
      let players = T.find(SELECTORS.player).toArray().map(p => clean($(p).text())).filter(x => x && !/^\d+$/.test(x));
      if (!players.length) players = [clean(T.clone().children().remove().end().text()).replace(/[\d\s]+$/, '')];
      const sets = nums(T.find(SELECTORS.set).toArray().map(s => $(s).text()));
      const pt = T.find(SELECTORS.point).toArray().map(p => clean($(p).text())).find(x => POINT.test(x)) || '';
      return {
        players: [...new Set(players)].slice(0, 2),
        sets, point: pt,
        serving: T.find(SELECTORS.serve).length > 0 || /serv/i.test(T.attr('class') || ''),
        winner: /win/i.test(T.attr('class') || '')
      };
    });
    out.push({
      id: m.attr('id') || m.attr('data-id') || String(i),
      court: clean(m.find(SELECTORS.court).first().text()),
      round: clean(m.find(SELECTORS.round).first().text()),
      status: status(m.text() + ' ' + (m.attr('class') || '')),
      teams: parsed
    });
  });
  return { matches: out };
}

function status(text) {
  if (/finish|final(izado)?\b|ended|terminado|w\/o|ret/i.test(text)) return 'finished';
  if (/not started|upcoming|scheduled|programado|starting|followed by|a continuaci/i.test(text)) return 'upcoming';
  return 'live';
}
