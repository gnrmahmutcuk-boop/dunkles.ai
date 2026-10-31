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
  // yaygın yapıştırma hatalarını otomatik temizle: boşluk, tırnak, "ADI=" öneki
  let key = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
  if (key.includes("=")) key = key.split("=").pop().trim();
  if (!key) return json({ error: "GEMINI_API_KEY Netlify'da tanımlı değil (Environment variables, sonra yeniden deploy)" }, 500);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Geçersiz istek" }, 400); }
  const { model, messages } = body || {};
  if (!MODELS.includes(model) || !Array.isArray(messages) || JSON.stringify(messages).length > 400000)
    return json({ error: "Geçersiz istek" }, 400);

  const payload = JSON.stringify(toGemini(messages));
  // Bir modeli dener: önce AI Studio adresi (yeni "AQ." anahtarlar dahil), olmazsa Vertex Express adresi
  const call = async (mdl) => {
    const attempts = [
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      },
    ];
    if (key.startsWith("AQ."))
      attempts.push({
        url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${mdl}:generateContent?key=${encodeURIComponent(key)}`,
        headers: { "Content-Type": "application/json" },
      });
    let out = { ok: false, status: 502, msg: "Gemini'ye ulaşılamadı" };
    for (const [n, a] of attempts.entries()) {
      try {
        const r = await fetch(a.url, { method: "POST", headers: a.headers, body: payload });
        const raw = await r.json().catch(() => ({}));
        const d = Array.isArray(raw) ? raw[0] : raw;
        if (r.ok) {
          const text = ((d.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
          return { ok: true, text: text || "(cevap yok)" };
        }
        if (n === 0 || out.status === 502) out = { ok: false, status: r.status, msg: (d && d.error && d.error.message) || "Google hatası" };
      } catch (e) {
        out = { ok: false, status: 502, msg: "Gemini'ye ulaşılamadı: " + e.message };
      }
    }
    return out;
  };

  let res = await call(model);
  // Güçlü model ücretli/kotalıysa ücretsiz hızlı modele düş
  if (!res.ok && model === "gemini-2.5-pro" && [400, 403, 404, 429].includes(res.status)) {
    const r2 = await call("gemini-2.5-flash");
    if (r2.ok) res = r2;
  }
  if (res.ok) return json({ choices: [{ message: { content: res.text } }] });
  const status = res.status, msg = res.msg;
  // Anahtar sorunluysa geçici yedek: anahtarsız ücretsiz servis
  if ([400, 401, 403].includes(status)) {
    try {
      const f = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai", messages }),
        signal: AbortSignal.timeout(8000),
      });
      if (f.ok) return json(await f.json());
    } catch {}
  }
  return json({ error: msg + ` [anahtar: ${key.length} karakter, başı "${key.slice(0, 4)}"]` }, status);
};

export const config = { path: "/api/chat" };
