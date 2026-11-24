// GET /api/ranking → Top 30 del ranking FIP masculino y femenino, leído de la página oficial.
// Solo guarda nombre, país, puntos y subida/bajada (sin fotos). Se guarda 6 h en caché.
import * as cheerio from 'cheerio';

const URL_RANK = 'https://www.padelfip.com/es/fip-rankings/?gender=Male';
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const num = s => parseInt(clean(s).replace(/[^\d]/g, ''), 10) || 0;
const mv = el => { const t = clean(el.text()); return /^[+-]\d+$/.test(t) ? Number(t) : 0; };

function parse(html) {
  const $ = cheerio.load(html);
  const out = {};
  for (const g of ['male', 'female']) {
    const list = [];
    $(`.ranking__${g} .player__card`).each((_, c) => {
      const C = $(c);
      list.push({
        pos: num(C.find('.player__rank').text()),
        name: clean(C.find('.player__name').first().text()),
        country: clean(C.find('.player__country').first().text()),
        points: num(C.find('.player__pointTNumber').text()),
        move: mv(C.find('.player__move').first())
      });
    });
    $(`.table__${g} tbody tr`).each((_, r) => {
      const R = $(r);
      const rankCell = R.find('.cell__rank');
      const moveEl = rankCell.find('span').first();
      const rc = rankCell.clone(); rc.find('span').remove();
      list.push({
        pos: num(rc.text()),
        name: clean(R.find('a.name').first().text()),
        country: clean(R.find('.player__country').first().text()),
        points: num(R.find('.cell__points').text()),
        move: mv(moveEl)
      });
    });
    out[g] = list.filter(x => x.name && x.pos);
  }
  const date = (html.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/) || [])[1] || '';
  return { date, ...out };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const r = await fetch(URL_RANK, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Por3/1.0)', 'Accept-Language': 'es' } });
    const html = await r.text();
    const data = parse(html);
    if (!data.male.length) throw new Error('sin datos (' + r.status + ')');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).end(JSON.stringify({ updated: new Date().toISOString(), ...data }));
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).end(JSON.stringify({ error: 'No se pudo leer el ranking: ' + String(e.message || e) }));
  }
}
