// Uso: npm run probe -- FIP-2026-XXXX
// Descarga el widget oficial, guarda el HTML/JSON en probe-output.html y muestra lo que entiende el lector.
import { writeFileSync } from 'node:fs';
import { fetchWidget, parse } from '../lib/fip.js';

const id = process.argv[2];
if (!id) { console.error('Uso: npm run probe -- FIP-2026-XXXX'); process.exit(1); }
const w = await fetchWidget(id);
writeFileSync('probe-output.html', w.body);
console.log(`URL: ${w.url}\nEstado: ${w.status}  Tipo: ${w.type}  Tamaño: ${w.body.length}`);
console.log('Guardado en probe-output.html');
console.log(JSON.stringify(parse(w.body, w.type), null, 2).slice(0, 4000));
