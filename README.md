# Traceframe

Traceframe checks an image for Content Credentials that record how it was created or edited, and shows basic file details. It does not guess whether an image without a credential is real or AI-generated.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

## Checks

```sh
npm test
npm run build
npm run test:phase0
```

The browser smoke test uses Chrome and writes its report and screenshot under the ignored `artifacts/` directory. Set `CHROME_PATH` if Chrome is installed elsewhere. For a known-image check, set `IMAGE_PATH` and optionally `IMAGE_PROVENANCE=ai-generated` or `IMAGE_PROVENANCE=camera-photo`. `MOBILE=1`, `PROFILE_DIR=<path>`, and `BASE_URL=<url>` configure viewport, browser profile, and server address.

## What a result means

- **AI origin recorded:** the file contains a Content Credential that records AI generation. Review the listed generator, signer, and history before relying on it.
- **Origin unknown:** no usable AI-generation record was found. This does not prove the image is camera-taken or authentic.
- **Credential failed validation / check unavailable:** the recorded claim could not be relied on or the app could not read it.

The exploratory image maps are educational views only. Traceframe does not provide a visual AI detector or an authenticity score because the tested classifier did not reliably separate known AI and camera images.

The app has no analytics, accounts, cookies, persistence, API route, or image-upload endpoint. Credential parsing and image maps run in the browser. The C2PA WASM runtime is bundled with the static app.

## Deploy to Vercel

Import the Git repository in Vercel. This is a static Vite app with no server function or database. The included `vercel.json` builds with `npm run build` and publishes `dist/`.

## Attribution

The C2PA reader is provided by [`@contentauth/c2pa-web`](https://github.com/contentauth/c2pa-web), distributed under the MIT license. The previously tested visual classifier was removed from the product because it gave nearly identical low signals for the supplied known-AI and camera images; its experiment notes remain in [the model validation record](docs/model-validation.md).
