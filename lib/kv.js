// Base de datos (Upstash Redis) a través de su API REST: guarda quién quiere avisos y cómo iba cada partido.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export async function kv(...cmd) {
  if (!URL_ || !TOKEN) throw new Error('Falta la base de datos (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
