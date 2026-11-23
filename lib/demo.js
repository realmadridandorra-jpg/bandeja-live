// Modo demostración: partidos simulados que avanzan solos con el reloj (un punto cada ~12 s).
// Sirve para enseñar la app cuando no hay torneo en juego. Los nombres son inventados.
const PAIRS = [
  [['Marcos Vidal', 'Iker Soto'], ['Lucas Ferrer', 'Hugo Prieto']],
  [['Nora Gil', 'Alba Ríos'], ['Carla Mena', 'Sara Pons']],
  [['Pablo Arce', 'Dani Lago'], ['Rubén Cid', 'Teo Marín']]
];
const COURTS = ['Pista Central', 'Pista 1', 'Pista 2'];

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// Motor de puntuación con Star Point: las dos primeras veces que se llega a 40-40 se juega ventaja;
// a la tercera, el siguiente punto decide el juego.
function play(n, seed) {
  const r = rng(seed), st = { sets: [], g: [0, 0], p: [0, 0], tb: false, srv: 0, dc: 0, win: null };
  const bias = 0.47 + r() * 0.06;
  for (let k = 0; k < n && st.win === null; k++) {
    const i = r() < (st.srv === 0 ? bias + 0.05 : bias - 0.05) ? 0 : 1, o = 1 - i;
    st.p[i]++;
    if (st.tb) {
      if (st.p[i] >= 7 && st.p[i] - st.p[o] >= 2) game(st, i);
      else if ((st.p[0] + st.p[1]) % 2 === 1) st.srv = 1 - st.srv;
      continue;
    }
    if (st.p[0] >= 3 && st.p[0] === st.p[1]) st.dc++;
    if (st.p[i] >= 4 && (st.p[i] - st.p[o] >= 2 || st.dc >= 3)) game(st, i);
  }
  return st;
}
function game(st, i) {
  const o = 1 - i; st.g[i]++; st.p = [0, 0]; st.dc = 0; st.srv = 1 - st.srv;
  if (st.tb || (st.g[i] >= 6 && st.g[i] - st.g[o] >= 2)) {
    st.sets.push([...st.g]); st.g = [0, 0]; st.tb = false;
    if (st.sets.filter(s => s[i] > s[o]).length === 2) st.win = i;
  } else if (st.g[0] === 6 && st.g[1] === 6) st.tb = true;
}
function label(st, i) {
  if (st.tb) return String(st.p[i]);
  const a = st.p[i], b = st.p[1 - i];
  if (a >= 3 && b >= 3) return a === b ? '40' : a > b ? 'A' : '40';
  return ['0', '15', '30', '40'][Math.min(a, 3)];
}

export function demoMatches(now = Date.now()) {
  const cycle = 150 * 12 * 1000; // cada partido dura ~30 min y vuelve a empezar
  return PAIRS.map((pair, m) => {
    const t = (now + m * cycle / 3) % cycle;
    const pts = Math.floor(t / 12000);
    const st = play(pts, 1000 + m * 77 + Math.floor((now + m * cycle / 3) / cycle));
    const sets = [...st.sets, ...(st.win === null ? [st.g] : [])];
    return {
      id: 'demo-' + m,
      court: COURTS[m],
      round: m === 1 ? 'Semifinal femenina' : m === 0 ? 'Semifinal masculina' : 'Cuartos de final',
      status: st.win === null ? 'live' : 'finished',
      starPoint: st.dc >= 3 && st.p[0] === st.p[1],
      teams: [0, 1].map(i => ({
        players: pair[i],
        sets: sets.map(s => s[i]),
        point: st.win === null ? label(st, i) : '',
        serving: st.win === null && st.srv === i,
        winner: st.win === i
      }))
    };
  });
}
