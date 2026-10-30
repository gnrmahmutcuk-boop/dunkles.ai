// Vercel serverless function: keeps your Gemini key secret on the server
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { model, messages } = req.body || {};
  if (!MODELS.includes(model) || !Array.isArray(messages) || JSON.stringify(messages).length > 400000)
    return res.status(400).json({ error: "Bad request" });
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GEMINI_API_KEY },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });
  res.status(r.status).json(await r.json());
}
