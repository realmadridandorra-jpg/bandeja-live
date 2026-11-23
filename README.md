# Bandeja Pro: pádel profesional en directo

App web con los torneos de Premier Padel 2026, el ranking de títulos y un **marcador en directo que se actualiza solo** cada 15 segundos, leyendo el marcador oficial que usa padelfip.com.

## Cómo funciona

```
Tu móvil  ──cada 15 s──▶  /api/live (Vercel)  ──cada 10 s como máximo──▶  widget oficial de marcador (Matchscorer / Crionet)
                              │
                              └─ lo traduce a un formato limpio (parejas, sets, punto, saque, pista, ronda)
```

- `public/index.html`: la app (Directo, Torneos y Títulos, más un marcador manual con Star Point, punto de oro o ventaja).
- `api/live.js`: pide el marcador oficial y devuelve JSON. Vercel guarda la respuesta 10 s en caché, así que aunque mire mucha gente solo se hace una petición cada 10 s.
- `api/debug.js`: enseña lo que devuelve el marcador oficial, para ajustar el lector si cambia.
- `lib/fip.js`: la descarga (con la cabecera `Referer: padelfip.com`, sin la cual el widget responde 403) y el lector.
- `lib/demo.js`: modo demostración con partidos simulados que avanzan solos.

## Subirlo a internet (gratis, unos 5 minutos)

1. Crea una cuenta en https://vercel.com (puedes entrar con GitHub).
2. Sube esta carpeta a un repositorio de GitHub nuevo.
3. En Vercel: **Add New → Project**, elige el repositorio y pulsa **Deploy**. No hace falta cambiar nada.
4. Abre la dirección que te da Vercel (algo como `bandeja-live.vercel.app`). En el móvil: Compartir → **Añadir a pantalla de inicio** y se verá como una app.

Para probarlo en tu ordenador: `npm install`, `npm i -g vercel` y `vercel dev`.

## Elegir el torneo

La app intenta encontrar sola el torneo que está en juego. Si no lo consigue (padelfip tiene protección anti-bots), indícalo tú:

- En la app: **Directo → Ajustes del directo → ID del torneo**, por ejemplo `FIP-2026-1234`.
- O para todo el mundo: en Vercel, **Settings → Environment Variables**, añade `FIP_TOURNAMENT_ID`.

El ID sale en la pestaña *Live Score* del torneo en padelfip.com. Suele aparecer en la dirección del marcador incrustado.

## La primera vez: comprobar el lector

No he podido ver desde fuera el formato exacto que devuelve el marcador oficial, así que el lector reconoce los partidos **por aproximación** (busca bloques de partido, parejas, sets y puntos). Con un torneo en juego:

1. Abre `https://TU-APP.vercel.app/api/debug?id=FIP-2026-XXXX`.
2. Si `status` es 200 y `parsed.matches` trae los partidos, ya está.
3. Si `parsed.matches` sale vacío pero `sample` trae datos, hay que ajustar `SELECTORS` en `lib/fip.js` a los nombres de clase reales. Pega la salida a Claude y te lo deja ajustado.
4. Si `status` es 403 o 404, la dirección del widget es otra: cámbiala en la variable `LIVE_URL_TEMPLATE` (mira `.env.example`).

También puedes probarlo en local con `npm run probe -- FIP-2026-XXXX`, que guarda la respuesta en `probe-output.html`.

## Modo demostración

En **Ajustes del directo** activa *Modo demostración*: salen tres partidos simulados, con nombres inventados, que suman un punto cada ~12 s, con saque, tie-break y Star Point. Sirve para enseñar la app cuando no hay torneo en juego.

## Antes de publicarla en serio

Leer el marcador oficial de otra web sirve para un proyecto personal o de clase. Para una app pública o en la App Store, pide permiso a la FIP/Premier Padel o contrata un proveedor de datos con licencia. Solo tendrías que cambiar `lib/fip.js` y el resto de la app sigue igual.
