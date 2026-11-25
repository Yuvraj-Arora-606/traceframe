# Traceframe

**A clearer picture of image origin.**

Traceframe checks embedded Content Credentials and asks a Groq vision model to inspect the image pixels. Credentials can provide recorded origin evidence; the vision model gives a cautious visual assessment when records are missing. Neither proves who made an image or whether it depicts a real event.

## What it does

- Reads C2PA Content Credentials locally in your browser.
- Highlights an AI-generation claim when the credential records one.
- Sends a resized image to Groq’s `qwen/qwen3.8-27b` vision model for qualitative visual review.
- Reports missing, invalid, and unreadable credentials separately from the visual assessment.
- Keeps the Groq API key on the server; the key is never sent to the browser.

## Run locally

Requirements: Node.js 22.12 or newer.

```sh
git clone https://github.com/Yuvraj-Arora-606/traceframe.git
cd traceframe
npm ci
```

Put your key in `.env.local`:

```sh
GROQ_API_KEY=your_groq_api_key
```

Then start the app:

```sh
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`. Restart the dev server after adding the key. The local API middleware and Vercel function use the same server-side handler.

## Read the result

| Result | Meaning |
| --- | --- |
| **AI origin recorded** | A readable Content Credential declares AI generation. Review the credential’s signer and history. |
| **Possible AI-like visual cues** | Groq’s vision model noticed visible details that may be consistent with generated imagery. This is a model opinion, not proof. |
| **No clear AI-like cues spotted** | The model did not identify a clear visual clue. This does not mean the image is real. |
| **Visual scan inconclusive / unavailable** | No useful visual assessment was available. The credential result remains separate. |

## Privacy

Content Credentials are inspected locally. When you press **Check this image**, Traceframe resizes the image and sends that copy through its server-side endpoint to Groq for visual review. Groq says inference inputs and outputs are not retained by default, but temporary reliability or abuse logs may retain them for up to 30 days; see [Groq’s data policy](https://console.groq.com/docs/your-data). Do not submit sensitive images. The API key remains server-side.

## Verify changes

```sh
npm test
npm run build
npm run test:phase0
```

The Playwright smoke check uses Chrome and writes a screenshot and report under the ignored `artifacts/` directory. Set `CHROME_PATH`, `BASE_URL`, `PROFILE_DIR`, `MOBILE=1`, or `IMAGE_PATH`. Set `IMAGE_PROVENANCE=ai-generated` or `camera-photo` to assert a known sample’s credential result.

## Deploy to Vercel

Import the repository in Vercel. The included `vercel.json` uses `npm ci`, `npm run build`, and `dist/`. Add `GROQ_API_KEY` under **Project Settings → Environment Variables**, then redeploy.

## Built with

- [Vite](https://vite.dev/)
- [`@contentauth/c2pa-web`](https://github.com/contentauth/c2pa-web) (MIT)
- [Groq vision API](https://console.groq.com/docs/vision) (`qwen/qwen3.8-27b`)
- [Playwright](https://playwright.dev/) and [Vitest](https://vitest.dev/)
