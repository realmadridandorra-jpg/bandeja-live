// Fuente de datos: el marcador oficial (Matchscorer de Crionet) que padelfip.com inserta en la pestaña Live Score.
// Página usada: https://widget.matchscorerlive.com/screen/oopbyday/{ID}?t=tol
//   → orden de juego del día de hoy, pista por pista, con resultado y estado de cada partido.
import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TEMPLATE = process.env.LIVE_URL_TEMPLATE || 'https://widget.matchscorerlive.com/screen/oopbyday/{id}?t=tol';

// Torneo por defecto si no se indica otro: Mexico Major 2026 (Acapulco, 21–29 nov).
export const DEFAULT_ID = 'FIP-2026-4801';

export function liveUrl(id, day) {
  const base = TEMPLATE.replace('{id}', encodeURIComponent(id));
  return day ? base.replace(`/${encodeURIComponent(id)}`, `/${encodeURIComponent(id)}/${day}`) : base;
}

export async function fetchWidget(id, day) {
  const url = liveUrl(id, day);
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.padelfip.com/',
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(8000)
  });
  return { url, status: res.status, type: res.headers.get('content-type') || '', body: await res.text() };
}

// Busca el ID del torneo en juego en la portada de padelfip. Puede fallar por su protección anti-bots.
export async function discoverTournamentId() {
  if (process.env.FIP_TOURNAMENT_ID) return process.env.FIP_TOURNAMENT_ID.trim();
  try {
    const res = await fetch('https://www.padelfip.com/es/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) });
    const ids = [...new Set((await res.text()).match(/FIP-20\d\d-\d{3,5}/g) || [])];
    if (ids[0]) return ids[0];
  } catch { /* sigue */ }
  return DEFAULT_ID;
}

const clean = s => (s || '').replace(/\s+/g, ' ').trim();

export function parse(html) {
  const $ = load(html);
  const day = clean($('.play-day-button.active .play-day-date').text());
  const matches = [];

  $('.oop-court').each((_, courtEl) => {
    const court = titleCase(clean($(courtEl).text()));
    const col = $(courtEl).closest('[class*="col-"]');
    col.find('table').each((i, tEl) => {
      const t = $(tEl);
      const header = t.find('tr[class*="scorebox-header"]').first();
      const rows = t.find('tr').filter((_, r) => $(r).find('td.team').length > 0).slice(0, 2);
      if (rows.length !== 2) return;

      const round = [clean(header.find('.round-name b').text()), clean(header.find('.round-name div').text())].filter(Boolean).join(' · ');
      const when = clean(header.find('.court-name').text());
      const statusText = clean(t.find('.live-status-summary .text-uppercase').text());
      const duration = clean(t.find('.live-status-summary .mr-4').text());

      const teams = rows.toArray().map(r => {
        const R = $(r);
        const players = R.find('.line-thin').toArray().map(p => {
          const P = $(p).clone(); P.find('small').remove(); return clean(P.text());
        }).filter(Boolean);
        const sets = R.find('td.set').toArray().map(s => parseInt(clean($(s).text()), 10)).filter(n => !Number.isNaN(n));
        // La celda sin clase entre el nombre y los sets guarda el punto del juego en curso.
        const pointCell = R.children('td').filter((_, td) => !$(td).hasClass('team') && !$(td).hasClass('set')).first();
        const marks = R.find('td.team .mr-2');
        return {
          players,
          seed: clean(R.find('.line-thin small').first().text()).replace(/[()]/g, ''),
          sets,
          point: clean(pointCell.text()),
          serving: marks.find('img, svg, [class*="serv"], [class*="ball"], i:not(.fa-check)').length > 0,
          winner: marks.find('.fa-check').length > 0
        };
      });

      matches.push({
        id: t.find('a.open').attr('data-id') || `${court}-${i}`,
        court, round, when, duration, statusText,
        status: statusOf(header.attr('class') || '', statusText, teams),
        teams
      });
    });
  });

  return { day, matches };
}

function statusOf(headerClass, text, teams) {
  if (/complet|finish|final|retir|walk|w\/o|default|cancel/i.test(text) || teams.some(t => t.winner)) return 'finished';
  if (/live|progress|playing|en juego|warm/i.test(text) || /live|progress/i.test(headerClass)) return 'live';
  if (teams.some(t => t.sets.length || t.point)) return 'live';
  return 'upcoming';
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
