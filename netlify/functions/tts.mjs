// Netlify function: ElevenLabs anahtarını sunucuda gizli tutar.
// Ücretsiz hesaplar "kütüphane seslerini" API ile kullanamaz; bu yüzden hesabındaki
// kullanılabilir bir sesi kendisi bulur. Sabit ses istersen ELEVENLABS_VOICE_ID ekle.
let goodVoice = null;

const speak = (id, text, key) =>
  fetch("https://api.elevenlabs.io/v1/text-to-speech/" + id, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });

async function candidates(key) {
  if (process.env.ELEVENLABS_VOICE_ID) return [process.env.ELEVENLABS_VOICE_ID.trim()];
  const ids = [];
  try {
    const v = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
    if (v.ok) {
      const rank = (c) => ({ premade: 0, generated: 1, cloned: 2, professional: 3 }[c] ?? 4);
      const list = ((await v.json()).voices || []).sort((a, b) => rank(a.category) - rank(b.category));
      list.slice(0, 3).forEach((x) => ids.push(x.voice_id));
    }
  } catch {}
  if (!ids.length) ids.push("21m00Tcm4TlvDq8ikWAM");
  return ids;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Sadece POST", { status: 405 });
  let key = (process.env.ELEVENLABS_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
  if (key.includes("=")) key = key.split("=").pop().trim();
  if (!key) return new Response("ELEVENLABS_API_KEY Netlify'da tanımlı değil", { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek", { status: 400 }); }
  const text = String((body || {}).text || "").slice(0, 1500);
  if (!text) return new Response("Metin yok", { status: 400 });

  const ids = goodVoice ? [goodVoice] : await candidates(key);
  let last = null;
  for (const id of ids) {
    const r = await speak(id, text, key);
    if (r.ok) {
      goodVoice = id;
      return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg" } });
    }
    last = r;
    goodVoice = null;
    if (![402, 403, 404, 422].includes(r.status)) break; // ses sorunu değilse boşuna deneme
  }
  let t = last ? await last.text() : "Ses bulunamadı";
  try { const d = JSON.parse(t).detail; t = typeof d === "string" ? d : (d && (d.message || d.status)) || t; } catch {}
  return new Response((last ? last.status + ": " : "") + String(t).slice(0, 200), { status: last ? last.status : 502 });
};

export const config = { path: "/api/tts" };
