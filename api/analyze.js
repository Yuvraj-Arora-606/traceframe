import { Buffer } from 'node:buffer';

const MODEL = 'qwen/qwen3.8-27b';
const MAX_IMAGE_DATA_URL_LENGTH = 3_800_000;
const allowedAssessments = new Set(['ai_like', 'no_clear_ai_cues', 'inconclusive']);
const requestWindows = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST to scan an image.' });
  if (!process.env.GROQ_API_KEY) return send(res, 503, { code: 'GROQ_NOT_CONFIGURED', error: 'Add GROQ_API_KEY to .env.local, then restart the dev server.' });
  const address = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  const now = Date.now();
  const bucket = requestWindows.get(address);
  if (bucket && now - bucket.startedAt < 60_000 && bucket.count >= 12) return send(res, 429, { error: 'Too many scans from this connection. Wait a minute and try again.' });
  if (!bucket || now - bucket.startedAt >= 60_000) requestWindows.set(address, { startedAt: now, count: 1 });
  else bucket.count += 1;
  try {
    const body = req.body ?? await readJson(req);
    const image = body?.image;
    if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return send(res, 400, { error: 'A resized JPEG, PNG, or WebP image is required.' });
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) return send(res, 413, { error: 'The prepared image is too large. Choose a smaller image.' });
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.1, max_completion_tokens: 220, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'You are an image-analysis assistant, not a forensic detector. Inspect only visual information in the provided image. Do not infer origin from subject, style, polish, stereotypes, or the user claim. Many real images and generated images have no obvious cues. Never claim certainty. Return JSON only with visual_assessment set to exactly one of ai_like, no_clear_ai_cues, inconclusive; observations as an array of at most two short, directly visible observations; and caveat as a short reminder that visual inspection cannot prove origin.' },
        { role: 'user', content: [{ type: 'text', text: 'Inspect this image for visible inconsistencies that could be consistent with AI generation. Choose ai_like only if you can describe concrete visible cues. Choose no_clear_ai_cues when you see no such cue. Choose inconclusive if you cannot judge. Do not guess.' }, { type: 'image_url', image_url: { url: image } }] },
      ] }), signal: AbortSignal.timeout(25_000),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = upstream.status === 401 ? 'Groq rejected the API key. Check GROQ_API_KEY.' : upstream.status === 429 ? 'Groq rate limit reached. Try again shortly.' : 'Groq could not analyze this image right now.';
      return send(res, upstream.status === 401 ? 401 : upstream.status === 429 ? 429 : 502, { error: message });
    }
    let parsed;
    try { parsed = JSON.parse(result.choices?.[0]?.message?.content ?? ''); } catch { return send(res, 502, { error: 'Groq returned an unreadable visual assessment. Try again.' }); }
    const assessment = allowedAssessments.has(parsed.visual_assessment) ? parsed.visual_assessment : 'inconclusive';
    const observations = Array.isArray(parsed.observations) ? parsed.observations.filter((item) => typeof item === 'string').slice(0, 2).map((item) => item.slice(0, 140)) : [];
    return send(res, 200, { assessment, observations, model: MODEL, caveat: 'A vision model can be wrong. This is not proof of image origin.' });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return send(res, timedOut ? 504 : 502, { error: timedOut ? 'Groq took too long to respond. Try again.' : 'The visual scan could not reach Groq. Check your connection and try again.' });
  }
}

function send(res, status, body) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); }
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_IMAGE_DATA_URL_LENGTH + 100_000) throw new Error('Request too large.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
