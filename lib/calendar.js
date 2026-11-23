// Calendario Premier Padel 2026 con el código de cada torneo en el marcador oficial (sacado de padelfip.com).
// start/end: días del torneo según padelfip (incluye la previa). days: número de días en el marcador.
export const CALENDAR = [
  { slug: 'riyadh', name: 'Riyadh Season', cat: 'P1', city: 'Riad, Arabia Saudí', id: 'FIP-2026-902', start: '2026-02-07', end: '2026-02-14', days: 8 },
  { slug: 'gijon', name: 'Gijón', cat: 'P2', city: 'Gijón, España', id: 'FIP-2026-0905', start: '2026-03-01', end: '2026-03-08', days: 8 },
  { slug: 'cancun', name: 'Cancún', cat: 'P2', city: 'Cancún, México', id: 'FIP-2026-1105', start: '2026-03-15', end: '2026-03-22', days: 8 },
  { slug: 'miami', name: 'Miami', cat: 'P1', city: 'Miami, EE. UU.', id: 'FIP-2026-1204', start: '2026-03-22', end: '2026-03-29', days: 8 },
  { slug: 'newgiza', name: 'Giza', cat: 'P2', city: 'Giza, Egipto', id: 'FIP-2026-4401', start: '2026-04-11', end: '2026-04-18', days: 8 },
  { slug: 'brussels', name: 'Bruselas', cat: 'P2', city: 'Bruselas, Bélgica', id: 'FIP-2026-1701', start: '2026-04-19', end: '2026-04-26', days: 8 },
  { slug: 'asuncion', name: 'Asunción', cat: 'P2', city: 'Asunción, Paraguay', id: 'FIP-2026-2111', start: '2026-05-03', end: '2026-05-10', days: 8 },
  { slug: 'buenos-aires', name: 'Buenos Aires', cat: 'P1', city: 'Buenos Aires, Argentina', id: 'FIP-2026-2209', start: '2026-05-10', end: '2026-05-17', days: 8 },
  { slug: 'italy', name: 'Italy Major', cat: 'Major', city: 'Roma, Italia', id: 'FIP-2026-2801', start: '2026-05-31', end: '2026-06-07', days: 8 },
  { slug: 'valencia', name: 'Valencia', cat: 'P1', city: 'Valencia, España', id: 'FIP-2026-2403', start: '2026-06-06', end: '2026-06-14', days: 9 },
  { slug: 'valladolid', name: 'Valladolid', cat: 'P2', city: 'Valladolid, España', id: 'FIP-2026-3801', start: '2026-06-21', end: '2026-06-28', days: 8 },
  { slug: 'bordeaux', name: 'Burdeos', cat: 'P2', city: 'Burdeos, Francia', id: 'FIP-2026-2401', start: '2026-06-28', end: '2026-07-05', days: 8 },
  { slug: 'malaga', name: 'Málaga', cat: 'P1', city: 'Málaga, España', id: 'FIP-2026-2802', start: '2026-07-11', end: '2026-07-19', days: 9 },
  { slug: 'pretoria', name: 'Pretoria', cat: 'P1', city: 'Pretoria, Sudáfrica', id: 'FIP-2026-3108', start: '2026-07-26', end: '2026-08-02', days: 8 },
  { slug: 'london', name: 'Londres', cat: 'P1', city: 'Londres, Reino Unido', id: 'FIP-2026-3208', start: '2026-08-02', end: '2026-08-09', days: 8 },
  { slug: 'madrid', name: 'Madrid', cat: 'P1', city: 'Madrid, España', id: 'FIP-2026-2902', start: '2026-08-29', end: '2026-09-06', days: 9 },
  { slug: 'paris', name: 'Paris Major', cat: 'Major', city: 'París, Francia', id: 'FIP-2026-3603', start: '2026-09-06', end: '2026-09-13', days: 8 },
  { slug: 'rotterdam', name: 'Rotterdam', cat: 'P2', city: 'Róterdam, Países Bajos', id: 'FIP-2026-3701', start: '2026-09-27', end: '2026-10-04', days: 8 },
  { slug: 'germany', name: 'Düsseldorf', cat: 'P2', city: 'Düsseldorf, Alemania', id: 'FIP-2026-3910', start: '2026-10-04', end: '2026-10-11', days: 8 },
  { slug: 'milano', name: 'Milano', cat: 'P1', city: 'Milán, Italia', id: 'FIP-2026-4902', start: '2026-10-10', end: '2026-10-18', days: 9 },
  { slug: 'kuwait', name: 'Kuwait Major', cat: 'Major', city: 'Kuwait', id: 'FIP-2026-4410', start: '2026-10-23', end: '2026-10-31', days: 9 },
  { slug: 'dubai', name: 'Dubái', cat: 'P1', city: 'Dubái, EAU', id: 'FIP-2026-4501', start: '2026-11-08', end: '2026-11-15', days: 8 },
  { slug: 'mexico', name: 'Mexico Major', cat: 'Major', city: 'Acapulco, México', id: 'FIP-2026-4801', start: '2026-11-21', end: '2026-11-29', days: 9 },
  { slug: 'finals', name: 'Premier Padel Finals', cat: 'Finals', city: 'Barcelona, España', id: 'FIP-2026-5101', start: '2026-12-10', end: '2026-12-13', days: 4 }
];

// Fecha de hoy en la zona horaria del torneo no se conoce de antemano: usamos UTC-6 (América) como margen,
// para que un torneo no "termine" antes de tiempo en las sedes americanas.
export function today() {
  return new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
}

// Torneo en juego hoy; si no hay, el próximo; si la temporada acabó, el último.
export function currentTournament(d = today()) {
  return CALENDAR.find(t => t.start <= d && d <= t.end)
    || CALENDAR.find(t => t.start > d)
    || CALENDAR[CALENDAR.length - 1];
}

export function byId(id) {
  return CALENDAR.find(t => t.id.toUpperCase() === String(id).toUpperCase());
}
