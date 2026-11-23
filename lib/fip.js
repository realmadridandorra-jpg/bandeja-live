// Fuente de datos: el marcador oficial (Matchscorer de Crionet) que padelfip.com inserta en sus páginas de torneo.
//   Orden de juego y resultados de un día: https://widget.matchscorerlive.com/screen/oopbyday/{ID}/{día}?t=tol
//   (sin día = el día de hoy del torneo)
//   Estadísticas de un partido: POST /screen/getmatchstats?t=tol  (lo mismo que hace su botón "Match stats")
import { load } from 'cheerio';

const BASE = process.env.MATCHSCORER_BASE || 'https://widget.matchscorerlive.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Referer: 'https://www.padelfip.com/',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

export function dayUrl(id, day) {
  return `${BASE}/screen/oopbyday/${encodeURIComponent(id)}${day ? '/' + Number(day) : ''}?t=tol`;
}

export async function fetchDay(id, day) {
  const url = dayUrl(id, day);
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  return { url, status: res.status, body: await res.text() };
}

const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const titleCase = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

// Lee una página de orden de juego: días del torneo, día activo y todos los partidos.
export function parseDay(html) {
  const $ = load(html);
  const days = $('.day-selector a').toArray().map((a, i) => {
    const A = $(a);
    const n = Number((A.attr('href') || '').match(/\/(\d+)(\?|$)/)?.[1] || i + 1);
    return { n, label: clean(A.find('.play-day-date').text()), week: clean(A.find('.play-day-week').text()), active: A.find('.active').length > 0 };
  });
  const active = days.find(d => d.active);
  const matches = [];

  $('.oop-court').each((_, courtEl) => {
    const court = titleCase(clean($(courtEl).text()));
    const col = $(courtEl).closest('[class*="col-"]');
    col.find('table').each((i, tEl) => {
      const t = $(tEl);
      const header = t.find('tr[class*="scorebox-header"]').first();
      const rows = t.find('tr').filter((_, r) => $(r).find('td.team').length > 0).slice(0, 2);
      if (rows.length !== 2) return;

      const roundName = clean(header.find('.round-name b').text());
      const roundSub = clean(header.find('.round-name div').text());
      const statusText = clean(t.find('.live-status-summary .text-uppercase').text());

      const teams = rows.toArray().map(r => {
        const R = $(r);
        const players = R.find('.line-thin').toArray().map(p => {
          const P = $(p).clone(); P.find('small').remove(); return clean(P.text());
        }).filter(Boolean);
        const sets = [], tb = [];
        R.find('td.set').each((_, s) => {
          const S = $(s).clone(); const sup = clean(S.find('sup').text()); S.find('sup').remove();
          const v = parseInt(clean(S.text()), 10);
          if (!Number.isNaN(v)) { sets.push(v); tb.push(sup ? Number(sup) : null); }
        });
        // La celda sin clase entre el nombre y los sets guarda el punto del juego en curso.
        const pointCell = R.children('td').filter((_, td) => !$(td).hasClass('team') && !$(td).hasClass('set')).first();
        const marks = R.find('td.team .mr-2');
        return {
          players,
          flags: R.find('img.flags').toArray().map(f => ($(f).attr('src') || '').match(/flags\/([A-Z]{3})/)?.[1] || ''),
          seed: clean(R.find('.line-thin small').first().text()).replace(/[()]/g, ''),
          sets, tb,
          point: clean(pointCell.text()),
          serving: marks.find('img, svg, [class*="serv"], [class*="ball"], i:not(.fa-check)').length > 0,
          winner: marks.find('.fa-check').length > 0
        };
      });

      const a = t.find('a.open');
      matches.push({
        id: a.attr('data-id') || `${court}-${i}`,
        tid: a.attr('data-tid') || '', year: a.attr('data-year') || '',
        court,
        round: [roundName, roundSub].filter(Boolean).join(' · '),
        event: eventOf(roundName, a.attr('data-id') || ''),
        when: clean(header.find('.court-name').text()),
        duration: clean(t.find('.live-status-summary .mr-4').text()),
        statusText,
        status: statusOf(header.attr('class') || '', statusText, teams),
        teams
      });
    });
  });

  return { days, day: active ? active.n : null, dayLabel: active ? active.label : '', matches };
}

// MD = cuadro masculino, WD = femenino, MQ/WQ = previas (según el código del partido y la ronda).
function eventOf(roundName, matchId) {
  const code = matchId.slice(0, 2).toUpperCase();
  if (['MD', 'WD', 'MQ', 'WQ'].includes(code)) return code;
  const q = /qualif/i.test(roundName);
  return /^wom/i.test(roundName) ? (q ? 'WQ' : 'WD') : (q ? 'MQ' : 'MD');
}

function statusOf(headerClass, text, teams) {
  if (/complet|finish|final|retir|walk|w\/o|default|cancel/i.test(text) || teams.some(t => t.winner)) return 'finished';
  if (/live|progress|playing|en juego|warm/i.test(text) || /live|progress/i.test(headerClass)) return 'live';
  if (teams.some(t => t.sets.length || t.point)) return 'live';
  return 'upcoming';
}

// Estadísticas de un partido (las del botón "Match stats" del marcador oficial).
export async function fetchStats({ matchId, year, tid }) {
  const res = await fetch(`${BASE}/screen/getmatchstats?t=tol`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams({ matchId, year, tournamentId: tid, organization: 'FIP' }),
    signal: AbortSignal.timeout(8000)
  });
  if (res.status !== 200) return { status: res.status };
  const $ = load(await res.text());
  const tabs = $('.nav-tabs .nav-link').toArray().map(n => clean($(n).text()));
  const panes = $('.tab-pane').toArray().map((p, i) => ({
    name: tabs[i] || (i ? 'Set ' + i : 'Partido'),
    rows: $(p).find('.stats-data-points').toArray().map(l => {
      const L = $(l), row = L.parent();
      const v = row.find('.stats-l1-values');
      return { label: clean(L.text()), a: clean(v.eq(0).text()), b: clean(v.eq(1).text()) };
    }).filter(r => r.label)
  })).filter(p => p.rows.length);
  return { status: 200, teams: $('.stats-team').toArray().map(t => clean($(t).text())), score: clean($('.stats-score').first().text()), time: clean($('.stats-matchtime').first().text()), panes };
}
