# Still / Signal

Still / Signal is a small browser app for an initial, cautious signal about whether an image resembles AI-generated imagery. The image is decoded and analyzed in the browser; the app does not upload it. Model files are fetched from Hugging Face on first use and may be cached by the browser.

This is an experimental classifier, not forensic evidence. It cannot prove who created an image, when it was made, or whether it depicts a real event. Its current decision boundary has not been evaluated on a held-out image set, and its results are not calibrated.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The first analysis loads the pinned model and ONNX Runtime assets. The analyzed image stays in browser memory.

## Checks

```sh
npm test
npm run build
```

The browser smoke test uses an installed Chrome executable and writes its local report and screenshot under the ignored `artifacts/` directory:

```sh
npm run test:phase0
```

Set `CHROME_PATH` if Chrome is installed elsewhere. The script supports `FORCE_WASM=1`, `FAIL_WEBGPU=1`, `MOBILE=1`, `PROFILE_DIR=<path>`, and `BASE_URL=<url>` for backend, fallback, responsive, cache, and preview checks.

## Model and privacy

The model, revision, Q4 ONNX dtype, runtime version, output semantics, and model host are in [src/model-config.js](src/model-config.js). The model is `onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX` at revision `f9fc6516b37cd7d1bec3b94847b3682ce97249f0`. The source training code uses the binary label mapping `real: 0, fake: 1`; this app turns the single raw logit into a non-numeric signal at the default zero boundary, with an experimental ±0.2 logit abstention margin. It never presents that value as a probability.

See [the feasibility report](docs/feasibility-spike.md) for measured browser behavior and [the validation status](docs/model-validation.md) for the current limits on interpreting results. No accuracy or reliability claim is made.

The app has no analytics, accounts, cookies, persistence, API route, or image-upload endpoint. Model requests go to Hugging Face by default. To use a compatible host with the same model repository path layout, set the public build-time variable `VITE_MODEL_BASE_URL`; it must serve the pinned model files and allow browser CORS. Never put a secret in a `VITE_` variable.

## Deploy to Vercel

Import the Git repository in Vercel. It is a static Vite app with no server function or database. The included `vercel.json` builds with `npm run build` and publishes `dist/`. The optional model-host variable is described above; no environment variable is required for the default Hugging Face host.

The model provider and Vercel bandwidth/cache limits remain operational constraints. A browser-side inference path avoids per-image API charges, but does not make model delivery unlimited or guarantee third-party availability.

## Attribution

The model is distributed under MIT terms and was developed by Jeongsoo Park and Andrew Owens at the University of Michigan. See [the model card](https://huggingface.co/onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX) and [the upstream training repository](https://github.com/JeongsooP/Community-Forensics). The model card marks its reported evaluation metrics as unverified; this app does not repeat them.
