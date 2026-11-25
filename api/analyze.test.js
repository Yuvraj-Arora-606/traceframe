import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './analyze.js';

function responseRecorder() {
  return { statusCode: 200, headers: {}, body: '', setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = body; } };
}

describe('Groq image scan endpoint', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GROQ_API_KEY; });

  it('requires a server-side API key without exposing image data upstream', async () => {
    delete process.env.GROQ_API_KEY;
    const res = responseRecorder();
    await handler({ method: 'POST', body: { image: 'data:image/jpeg;base64,AAAA' }, headers: { 'x-forwarded-for': 'test-missing-key' } }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).code).toBe('GROQ_NOT_CONFIGURED');
  });

  it('returns only the validated visual assessment fields from Groq', async () => {
    process.env.GROQ_API_KEY = 'test-only-key';
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ visual_assessment: 'ai_like', observations: ['Odd window reflections'], caveat: 'Not proof' }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const res = responseRecorder();
    await handler({ method: 'POST', body: { image: 'data:image/jpeg;base64,AAAA' }, headers: { 'x-forwarded-for': 'test-assessment' } }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ assessment: 'ai_like', observations: ['Odd window reflections'] });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-key');
  });
});
