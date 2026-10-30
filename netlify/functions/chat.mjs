// Netlify function: Gemini anahtarını sunucuda gizli tutar
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Sadece POST" }, 405);
  if (!process.env.GEMINI_API_KEY)
    return json({ error: "GEMINI_API_KEY Netlify'da tanımlı değil (Environment variables, sonra yeniden deploy)" }, 500);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Geçersiz istek" }, 400); }
  const { model, messages } = body || {};
  if (!MODELS.includes(model) || !Array.isArray(messages) || JSON.stringify(messages).length > 400000)
    return json({ error: "Geçersiz istek" }, 400);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GEMINI_API_KEY },
      body: JSON.stringify({ model, messages, max_tokens: 2048 }),
    });
    const raw = await r.json().catch(() => ({}));
    return json(Array.isArray(raw) ? raw[0] : raw, r.status);
  } catch (e) {
    return json({ error: "Gemini'ye ulaşılamadı: " + e.message }, 502);
  }
};

export const config = { path: "/api/chat" };
