// Netlify function: ElevenLabs anahtarını sunucuda gizli tutar
export default async (req) => {
  if (req.method !== "POST") return new Response("Sadece POST", { status: 405 });
  let key = (process.env.ELEVENLABS_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
  if (key.includes("=")) key = key.split("=").pop().trim();
  if (!key) return new Response("ELEVENLABS_API_KEY Netlify'da tanımlı değil", { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response("Geçersiz istek", { status: 400 }); }
  const text = String((body || {}).text || "").slice(0, 1500);
  if (!text) return new Response("Metin yok", { status: 400 });
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voice, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) {
    let t = await r.text();
    try { const d = JSON.parse(t).detail; t = typeof d === "string" ? d : (d && (d.message || d.status)) || t; } catch {}
    return new Response(r.status + ": " + String(t).slice(0, 200), { status: r.status });
  }
  return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg" } });
};

export const config = { path: "/api/tts" };
