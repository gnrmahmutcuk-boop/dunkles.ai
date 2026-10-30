// Vercel serverless function: keeps your ElevenLabs key secret on the server
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const text = String((req.body || {}).text || "").slice(0, 1500);
  if (!text) return res.status(400).end();
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voice, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) return res.status(r.status).end();
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(Buffer.from(await r.arrayBuffer()));
}
