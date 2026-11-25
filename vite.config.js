import { defineConfig, loadEnv } from 'vite';
import analyze from './api/analyze.js';

function groqApiPlugin() {
  const middleware = async (req, res, next) => {
    if (req.method !== 'POST') return next();
    const chunks = [];
    try {
      for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return analyze(req, res);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid scan request.' }));
    }
  };
  return { name: 'traceframe-groq-api', configureServer(server) { server.middlewares.use('/api/analyze', middleware); }, configurePreviewServer(server) { server.middlewares.use('/api/analyze', middleware); } };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GROQ_API_KEY) process.env.GROQ_API_KEY = env.GROQ_API_KEY;
  return { plugins: [groqApiPlugin()] };
});
