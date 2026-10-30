// Netlify function: Gemini anahtarını sunucuda gizli tutar.
// "AIza..." (AI Studio) ve "AQ...." (Vertex AI Express) anahtarlarının ikisini de destekler.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

function toGemini(messages) {
  let system = "";
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") { system += (typeof m.content === "string" ? m.content : "") + "\n"; continue; }
    const parts = [];
    if (typeof m.content === "string") parts.push({ text: m.content });
    else for (const p of m.content || []) {
      if (p.type === "text") parts.push({ text: p.text });
      else if (p.type === "image_url") {
        const mt = /^data:(.*?);base64,(.*)$/.exec((p.image_url && p.image_url.url) || "");
        if (mt) parts.push({ inlineData: { mimeType: mt[1], data: mt[2] } });
      }
    }
    if (parts.length) contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  const body = { contents, generationConfig: { maxOutputTokens: 4096 } };
  if (system.trim()) body.systemInstruction = { parts: [{ text: system.trim() }] };
  return body;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Sadece POST" }, 405);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY Netlify'da tanımlı değil (Environment variables, sonra yeniden deploy)" }, 500);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Geçersiz istek" }, 400); }
  const { model, messages } = body || {};
  if (!MODELS.includes(model) || !Array.isArray(messages) || JSON.stringify(messages).length > 400000)
    return json({ error: "Geçersiz istek" }, 400);

  const vertex = key.startsWith("AQ.");
  const url = vertex
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const headers = { "Content-Type": "application/json" };
  if (!vertex) headers["x-goog-api-key"] = key;

  try {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(toGemini(messages)) });
    const raw = await r.json().catch(() => ({}));
    const d = Array.isArray(raw) ? raw[0] : raw;
    if (!r.ok) return json({ error: (d && d.error && d.error.message) || "Google hatası" }, r.status);
    const text = ((d.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return json({ choices: [{ message: { content: text || "(cevap yok)" } }] });
  } catch (e) {
    return json({ error: "Gemini'ye ulaşılamadı: " + e.message }, 502);
  }
};

export const config = { path: "/api/chat" };
        
