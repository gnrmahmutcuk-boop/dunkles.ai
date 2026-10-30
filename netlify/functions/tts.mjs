// Netlify function: ElevenLabs anahtarını sunucuda gizli tutar
export default async (req) => {
  if (req.method !== "POST") return new Response("Sadece POST", { status: 405 });
  if (!process.env.ELEVENLABS_API_KEY) return new Response("Anahtar yok", { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek", { status: 400 }); }
  const text = String((body || {}).text || "").slice(0, 1500);
  if (!text) return new Response("Metin yok", { status: 400 });
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voice, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) return new Response((await r.text()).slice(0, 300), { status: r.status });
  return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg" } });
};

export const config = { path: "/api/tts" };
